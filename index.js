const webSocketsServerPort = process.env.PORT || 8000;
console.log('Listening port: ' + webSocketsServerPort);

const webSocketServer = require('websocket').server;
const http = require('http');
//const url = require('url');

// Spinning the http server and the websocket server.
const server = http.createServer(function(req, res){


/*
  const q = url.parse(req.url, true).query;
  console.log('received url: ' + req.url);
*/
  const { headers, method, url } = req;
  let body = [];
  req.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();
    // At this point, we have the headers, method, url and body, and can now
    // do whatever we need to in order to respond to this request.

    console.log("received header: " + headers['Content-type'])
    console.log("received header: " + headers['user-agent'])
    console.log("received method: " + method)
    console.log("received url: " + url)

    //console.log('received body: ' + body.toString());
    console.log('received body: ' + body);

    const requestBody = JSON.parse(body);
    const par = requestBody.result.parameters;

    console.log("received state parameter: " + par.state);
    console.log("received location parameter: " + par.location);
    console.log("received device parameter: " + par.device);

    res.on('error', (err) => {
      console.error(err);
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    // Note: the 2 lines above could be replaced with this next one:
    // response.writeHead(200, {'Content-Type': 'application/json'})

    const responseBody = { headers, method, url, body };

    res.write(JSON.stringify(responseBody));
    res.end();
    // Note: the 2 lines above could be replaced with this next one:
    // response.end(JSON.stringify(responseBody))

    /*
    res.writeHead(200, {'Content-Type' : 'text/html'})
    res.write('Hello World!')
    res.end();
    */
  })

});

server.listen(webSocketsServerPort);
const wsServer = new webSocketServer({
  httpServer: server
});

// Generates unique ID for every new connection
const getUniqueID = () => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return s4() + s4() + '-' + s4();
};

// I'm maintaining all active connections in this object
const clients = {};
// I'm maintaining all active users in this object
const users = {};
// The current editor content is maintained here.
let instParameters = {};
// User activity history.
let userActivity = [];



const sendMessage = (json) => {
  // We are sending the current data to all connected clients
  Object.keys(clients).map((client) => {
    clients[client][connection].sendUTF(json);
  });
}

const typesDef = {
  INSTRUCTION: "instruction",
  FEEDBACK: "feedback",
  INSTRUCTOR: "instructor",
  DEVICE: "device",
  SERVER: "server",
  INFORMATION : 'information',
  QUERY : "query"
}

function processDeviceMessage(userID, dataFromClient){

    if (dataFromClient.message.messageType === typesDef.INTRODUCTION) {
      //this is an introduction from a device/car
      clients[userID]['userName'] = dataFromClient.message.messageContent;
      console.log('server received an introduction from client ' + userID + ' : ' + dataFromClient.message.messageContent)
      //track client actions
      users[userID] = dataFromClient;
      userActivity.push(`${dataFromClient.message.messageContent} joined`);

      console.log('connections stored in server: ' + JSON.stringify(clients))
      //TODO: send updated available users list to all instructors
      //json.data = {users};


    } else if (dataFromClient.message.messageType === typesDef.FEEDBACK) {
      //this is a feedback from a device/car

      //TODO: send the feedback to the instructor
      userActivity.push(`${dataFromClient.username} sent an instruction`);
      json.data = { users, userActivity };


      instParameters = dataFromClient.parameters;
      json.data = { instParameters, userActivity };

    }
}


function processInstructorMessage(userID, dataFromClient){
  if (dataFromClient.message.messageType === typesDef.INTRODUCTION) {
    //this is an introduction from an instructor
    //users[userID] = dataFromClient;
    userActivity.push(`${dataFromClient.username} sent an instruction`);
    json.data = { users, userActivity };
  } else if (dataFromClient.message.messageType === typesDef.INSTRUCTION) {
            //this is an instruction from an instructor
            //TODO: parse the instruction and send corresponding instruction to the car
  }

}

wsServer.on('request', function(request) {
  var userID = getUniqueID();
  console.log((new Date()) + ' Recieved a new connection from origin ' + request.origin + '.');
  let connection;
  if (request.resourceURL.path === '/ws') {
    // Accept the request from esp8266 (indicator /ws) and send back a user id
    connection = request.accept(null, request.origin);

    //add a new client to memory
    clients[userID] = {'connection': connection, 'deviceType': typesDef.DEVICE};
    console.log('A ' + typesDef.DEVICE + ' connected: ' + userID + ' in ' + Object.getOwnPropertyNames(clients));

  }else if (request.resourceURL.path === '/mb') {
    clients[userID] = {'connection': connection, 'deviceType': typesDef.INSTRUCTOR};
    console.log('An ' + typesDef.INSTRUCTOR + ' connected: ' + userID + ' in ' + Object.getOwnPropertyNames(clients));
  }

  /*

  //TODO: send the assigned userID back to the new client
  connection.send(JSON.stringify({
    'deviceType' : typesDef.SERVER,
    'message' : {
      'messageType' : typesDef.INFORMATION,
      'messageContent' : userID
    }
  }))
  */

  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log('data: ' + message.utf8Data);
      const dataFromClient = JSON.parse(message.utf8Data);
      const json = { 'deviceType': dataFromClient.deviceType };
      if (dataFromClient.deviceType === typesDef.INSTRUCTOR) {
        //TODO: process message from an instructor
        processInstructorMessage(userID, dataFromClient);
      } else if (dataFromClient.deviceType === typesDef.DEVICE) {
        //TODO: process a message from a device/car
        processDeviceMessage(userID, dataFromClient);

      }
      //sendMessage(JSON.stringify(json));
    }
  });

  // user disconnected
  connection.on('close', function(connection) {
    console.log((new Date()) + " Peer " + userID + " disconnected.");
    const json = { type: typesDef.USER_EVENT };
    userActivity.push(`${users[userID].username} left the document`);
    json.data = { users, userActivity };
    delete clients[userID];
    delete users[userID];
    sendMessage(JSON.stringify(json));
  });
});
