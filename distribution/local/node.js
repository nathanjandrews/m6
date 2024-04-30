const http = require('http');
const {serialize, deserialize} = require('../util');
const local = require('.');

// The start function will be called to start your node.
// It will take a callback as an argument.
// After your node has booted, you should call the callback.

const start = function(onStart) {
  const server = http.createServer((req, res) => {
    // This is a default callback which will be passed to services.
    // It will be called by the service with the result of it's call
    // then it will serialize the result and send it back to the caller.
    const serviceCallback = (e, v) => {
      res.end(serialize([e, v]));
    };

    // ! Only handle PUT requests
    if (req.method !== 'PUT') {
      serviceCallback(
          new Error(`only handling PUT requests, got ${req.method}`),
          null,
      );
      return;
    }

    // ! The path of the http request will determine the service to be used.
    // ! The url will have the form: http://node_ip:node_port/service/method

    // handle potential errors with the request URL and request header
    if (!req.url) {
      serviceCallback(new Error('request url not found'), null);
      return;
    }

    if (!req.headers.host) {
      serviceCallback(new Error('request host not found'));
      return;
    }

    const url = new URL(`http://${req.headers.host}${req.url}`);
    const subDirs = url.pathname.split('/').filter((dir) => dir !== '');
    const serviceName = subDirs[0];
    const methodName = subDirs[1];

    if (!serviceName) {
      serviceCallback(new Error('no service name in URL path'));
      return;
    }

    if (!methodName) {
      serviceCallback(new Error('no method name in URL path'));
      return;
    }

    // log the request
    console.log(`[SERVER] (${global.nodeConfig.ip}:${global.nodeConfig.port})
      Request: ${serviceName}:${methodName}`);

    // A common pattern in handling HTTP requests in Node.js is to have a
    // subroutine that collects all the data chunks belonging to the same
    // request. These chunks are aggregated into a body variable.
    //
    // When the req.on('end') event is emitted, it signifies that all data from
    // the request has been received. Typically, this data is in the form of a
    // string. To work with this data in a structured format, it is often parsed
    // into a JSON object using JSON.parse(body), provided the data is in JSON
    // format.
    //
    // Our nodes expect data in JSON format.

    // accumulate the body into one variable
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    // handle completed request
    req.on('end', () => {
      try {
        // deserialize request
        const message = deserialize(body);

        // find and invoke proper service method
        local.routes.get(serviceName, (error, service) => {
          if (error) {
            serviceCallback(error);
            console.error(error);
            return;
          }

          // log the args to the service method
          console.log(`[SERVER] Args: ${JSON.stringify(message)} 
            ServiceCallback: ${serviceCallback}`);

          // call the method
          const method = service[methodName];
          if (!method) {
            const error = new Error(
                `unknown method "${methodName}" on service "${serviceName}"`,
            );
            serviceCallback(error);
            console.error(error);
            return;
          }

          method(...message, serviceCallback);
        });
      } catch (e) {
        serviceCallback(new Error(`method "${methodName}" threw: ${e}`));
      }
    });
  });

  /*
    Your server will be listening on the port and ip specified in the config
    You'll need to call the started callback when your server has successfully
    started.

    In this milestone, you'll be passing the server object to this callback
    so that we can close the server when we're done with it.
    In future milestones, we'll add the ability to stop the node
    through the service interface.
  */

  // store the server so that it is globally accessible
  global.server = server;

  server.listen(global.nodeConfig.port, global.nodeConfig.ip, () => {
    console.log(`Server running at http://${global.nodeConfig.ip}:${global.nodeConfig.port}/`);
    onStart(server);
  });
};

module.exports = {
  start: start,
};
