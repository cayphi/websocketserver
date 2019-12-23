const webSocketsServerPort = process.env.PORT || 8000;
console.log('Listening port: ' + webSocketsServerPort);

const webSocketServer = require('websocket').server;
const http = require('http');

// Spinning the http server and the websocket server.
const server = http.createServer(function(req, res){

/*
  const url = require('url');
  const q = url.parse(req.url, true).query;
  console.log('received url: ' + req.url);
*/

  //get body from http requests
  //grab the body by listening to stream's 'data' and 'end' events
  //collect all chunk (data) and then concatunate them upon receiving 'end' event
  const { headers, method, url } = req;
  let body = [];
  req.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();

    console.log("received header: " + headers['Content-type'])
    console.log("received header: " + headers['user-agent'])
    console.log("received method: " + method)
    console.log("received url: " + url)
    console.log('received body: ' + body);

    const requestBody = JSON.parse(body);
    const par = requestBody.queryResult.parameters;

    console.log("received command parameter: " + par.command);
    console.log("received device parameter: " + par.device);
    console.log("received status parameter: " + par.status);

    console.log("sending command to all available cars: ");

    //process parametes sent by Google Home
    if (par.command === 'stop') {
      cmd = commandsDef.STOP;
    }else if (par.command === 'turn' || par.command === 'go'){
      if(par.status === 'right') {
        cmd = commandsDef.RIGHT;
      } else if (par.status === 'left'){
        cmd = commandsDef.LEFT;
      } else if (par.status === 'back') {
        cmd = commandsDef.BACK;
      } else if (par.status === 'straight') {
        cmd = commandsDef.FORWARD;
      }else {
        cmd = ''
      }
    }

    //send corresponding instruction to ALL available esp8266
    Object.keys(clients).map((client) => {
      if (clients[client]['deviceType'] === typesDef.DEVICE) {
        clients[client]['connection'].sendUTF(JSON.stringify({
          deviceType : 'server',
          message : {
            messageType : 'instruction',
            messageContent : cmd
          }
        }))
      }
    })

    res.on('error', (err) => {
      console.error(err);
    });

    //send feedback back to GoogleHome
    //TODO: need to rewrite this according to DialogFlow requirement V2
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

//websocket session
server.listen(webSocketsServerPort);
const wsServer = new webSocketServer({
  httpServer: server
});

// Generates unique ID for every new connection
const getUniqueID = () => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return s4() + s4() + '-' + s4();
};

// store all active websocket connections in this object
const clients = {};

// store all active users in this object
const users = {};

// User activity history.
let userActivity = [];

const sendMessage = (json) => {
  // We are sending the current data to all connected clients
  Object.keys(clients).map((client) => {
    clients[client][connection].sendUTF(json);
  });
}

//send all the list of available cars to a particular instructor (instructorID)
function sendAvailableDeviceList(instructorID){
  //create an object containing all available cars
  let json = {deviceType: typesDef.SERVER}
  json['message'] = {messageType : typesDef.INFORMATION}
  json['message']['messageContent'] = Object.keys(clients).reduce((total, current) => {
    if (clients[current].deviceType === typesDef.DEVICE) {
      total[current] = clients[current]['userName']
    }
    return total
  }, {})
  //send the object to the instructor
  clients[instructorID]['connection'].sendUTF(JSON.stringify(json))
}

//send a list of all available car list to all available instructors
function sendAvailableDeviceList(){
  //create an object containing all available cars
  let json = {deviceType: typesDef.SERVER}
  json['message'] = {messageType : typesDef.INFORMATION}
  json['message']['messageContent'] = Object.keys(clients).reduce((total, current) => {
    if (clients[current].deviceType === typesDef.DEVICE) {
      total[current] = clients[current]['userName']
    }
    return total
  }, {})

  //send updated device list to all instructors
  Object.keys(clients).map((client) => {
    if (clients[client]['deviceType'] === typesDef.INSTRUCTOR) {
      clients[client]['connection'].sendUTF(JSON.stringify(json))
    }
  })

}

const commandsDef = {
  RIGHT : 'right',
  LEFT : 'left',
  FORWARD : 'forward',
  BACK : 'back',
  STOP : 'stop'
}

const typesDef = {
  INSTRUCTION: 'instruction',
  INTRODUCTION : 'introduction',
  FEEDBACK: 'feedback',
  INSTRUCTOR: 'instructor',
  DEVICE: 'device',
  SERVER: 'server',
  INFORMATION : 'information',
  QUERY : 'query'
}

//process a message sent by a car
function processDeviceMessage(userID, dataFromClient){

    if (dataFromClient.message.messageType === typesDef.INTRODUCTION) {
      //this is an introduction from a car
      console.log('current user id: ' + userID)
      clients[userID]['userName'] = dataFromClient.message.messageContent;
      console.log('server received an introduction from client ' + userID + ' : ' + dataFromClient.message.messageContent)

      //track car actions for later customization
      users[userID] = dataFromClient;
      userActivity.push(`${dataFromClient.message.messageContent} joined`);

      console.log('sending current clients details to client')
      clients[userID]['connection'].sendUTF('Welcome! Your name has been recorded on the server: ' + clients[userID].userName);

      console.log('current users details at server: ' + JSON.stringify(users))

      //send updated available cars list to all instructors
      sendAvailableDeviceList();

    } else if (dataFromClient.message.messageType === typesDef.FEEDBACK) {
      //this is a feedback from the car to update its status
      //TODO: send corresponding message to the relative instructor/GoogleHome

    } else {
      //TODO: any other type of message will be implemented here

    }
}

//process a message from an instructor
function processInstructorMessage(userID, dataFromClient){
  if (dataFromClient.message.messageType === typesDef.INTRODUCTION) {
    //this is an introduction from an instructor
    console.log('received an introduction from an instructor: ' + dataFromClient.message.messageContent)

    //send a list of available device to the instructor
    sendAvailableDeviceList(userID)
    console.log('sent updated device list to the instructor')

    //track instructors' actions for later customization
    users[userID] = dataFromClient;
    userActivity.push(`${dataFromClient.message.messageContent} joined`);


  } else if (dataFromClient.message.messageType === typesDef.INSTRUCTION) {
    //this is an instruction from an instructor

    //track action for later customization
    userActivity.push(`${userID} sent an instruction`);

    //TODO: parse the instruction and send corresponding instruction to the car
    if (typeof(clients[dataFromClient.message.targetDeviceID]) != 'undefined') {
      clients[dataFromClient.message.targetDeviceID]['connection'].sendUTF(JSON.stringify({
        deviceType : typesDef.SERVER,
        message : {
          messageType : typesDef.INSTRUCTION,
          messageContent : dataFromClient.message.messageContent
        }
      }))
    } else {
      //TODO: send a failure feedback to the instructor
    }

  }

}


//process websocket connection initiation
wsServer.on('request', function(request) {
  var userID = getUniqueID();
  console.log((new Date()) + ' Recieved a new connection from origin ' + request.origin + '.');
  console.log('path: ' + request.resourceURL.path)

  let connection;
  if (request.resourceURL.path === '/ws') {
    // Accept the connection from esp8266 (indicator /ws)
    connection = request.accept(null, request.origin);

    //add a new client to memory
    clients[userID] = {'connection': connection, 'deviceType': typesDef.DEVICE};
    console.log('A ' + typesDef.DEVICE + ' connected: ' + userID + ' in ' + Object.getOwnPropertyNames(clients));

  }else if (request.resourceURL.path === '/mb') {
    // Accept the connection from mobile (indicator /mb)
    connection = request.accept(null, request.origin);

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

  //process websocket messages
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log('data: ' + message.utf8Data);
      const dataFromClient = JSON.parse(message.utf8Data);
      const json = { 'deviceType': dataFromClient.deviceType };
      console.log('device Type: ' + dataFromClient.deviceType);
      console.log('type of dataFromClient.deviceType: ' + typeof(dataFromClient.deviceType));
      console.log('type of typesDef.DEVICE: ' + typeof(typesDef.DEVICE));

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

  // car disconnected
  connection.on('close', function(reasonCode, description) {


    //track the action for later customization
    userActivity.push(`${users[userID].userName} left`);

    //TODO: send updated available device list to all instructors
    if (clients[userID]['deviceType'] === typesDef.DEVICE ) {
      delete clients[userID];
      delete users[userID];
      console.log((new Date()) + userID + ": ");
      console.log ('a car has been disconnected, remaining conneciton list: ' + Object.getOwnPropertyNames(clients))
      sendAvailableDeviceList();

    } else if (clients[userID]['deviceType'] === typesDef.INSTRUCTOR){
      delete clients[userID];
      delete users[userID];
      console.log((new Date()) + userID + ": ");
      console.log ('an instructor has been disconnected, remaining conneciton list: ' + Object.getOwnPropertyNames(clients))
    }

  });
});
