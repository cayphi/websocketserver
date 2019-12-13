const webSocketsServerPort = process.env.PORT || 8000;
console.log('Listening port: ' + webSocketsServerPort);

const webSocketServer = require('websocket').server;
const http = require('http');
const url = require('url');

// Spinning the http server and the websocket server.
const server = http.createServer(function(req, res){


  //const q = url.parse(req.url, true).query;
  const urlObj = url.parse(req.url, true)

  console.log('received url: ' + req.url);

  //const { headers, method, url } = req;
  const { headers, method } = req;
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
    console.log("received url: " + urlObj.toString())

    //console.log('received body: ' + body.toString());
    console.log('received body: ' + body);

    const requestBody = JSON.parse(body);
    const par = requestBody.queryResult.parameters;

    console.log("received command parameter: " + par.command);
    console.log("received device parameter: " + par.device);
    console.log("received status parameter: " + par.status);

    sendMessage(par)

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

// I'm maintaining arduino connection here
let arduinoClient = {};

//I'm maintaining arduino data here
let arduinoData = null;

const sendMessage = (json) => {
  // We are sending commands to arduino the client
    arduinoClient.sendUTF(JSON.stringify(json));
}

const updateData = (json) => {
  arduinoData = json.content;
}

const typesDef = {
  CLIENT_KEEP_ALIVE: "keepalive",
  CLIENT_FEEDBACK: "feedback"
}

wsServer.on('request', function(request) {
  console.log((new Date()) + ' Recieved a new connection from origin ' + request.origin + '.');
  // You can rewrite this part of the code to accept only the requests from allowed origin
  const connection = request.accept(null, request.origin);
  arduinoClient = connection;

  //const q = url.parse(req.url, true).query;
  //const urlObj = url.parse(request.resource, true)
  console.log('received url: ' + request.resource);
  console.log('connected with path: ' + request.resourceURL.path);

  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log('data: ' + message.utf8Data);
      const dataFromClient = JSON.parse(message.utf8Data);
      const json = { type: dataFromClient.type };
      if (dataFromClient.type === typesDef.CLIENT_KEEP_ALIVE) {
        console.log('received a keepalive message: ' + dataFromClient.content)
      } else if (dataFromClient.type === typesDef.CLIENT_FEEDBACK) {
        updateData(dataFromClient);
        console.log('received a feedback message from the arduino client: ' + dataFromClient.content)
      }
    }

  });

  // user disconnected
  connection.on('close', function(connection) {
    console.log((new Date()) + " the arduino client disconnected.");
    delete client;
  });
});
