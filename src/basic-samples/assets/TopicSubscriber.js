/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Solace Web Messaging API for JavaScript
 * Publish/Subscribe tutorial - Topic Subscriber
 * Demonstrates subscribing to a topic for direct messages and receiving messages
 */

/*jslint es6 browser devel:true*/
/*global solace*/

var TopicSubscriber = function(topicName) {
  "use strict";
  var subscriber = {};
  subscriber.session = null;
  subscriber.topicName = topicName;
  subscriber.subscribed = false;
  subscriber.check = 0;

  // Logger
  subscriber.log = function(line) {
    var now = new Date();
    var time = [
      ("0" + now.getHours()).slice(-2),
      ("0" + now.getMinutes()).slice(-2),
      ("0" + now.getSeconds()).slice(-2)
    ];
    var timestamp = "[" + time.join(":") + "] ";
    // console.log(timestamp + line);
    var logTextArea = document.getElementById("log");
    logTextArea.value += timestamp + line + "\n";
    logTextArea.scrollTop = logTextArea.scrollHeight;
  };

  subscriber.log(
    '\n*** Subscriber to topic "' +
      subscriber.topicName +
      '" is ready to connect ***'
  );

  // Establishes connection to Solace router
  subscriber.connect = function() {
    // extract params
    if (subscriber.session !== null) {
      subscriber.log("Already connected and ready to subscribe.");
      return;
    }
    var hosturl = document.getElementById("hosturl").value;
    // check for valid protocols
    if (
      hosturl.lastIndexOf("ws://", 0) !== 0 &&
      hosturl.lastIndexOf("wss://", 0) !== 0 &&
      hosturl.lastIndexOf("http://", 0) !== 0 &&
      hosturl.lastIndexOf("https://", 0) !== 0
    ) {
      subscriber.log(
        "Invalid protocol - please use one of ws://, wss://, http://, https://"
      );
      return;
    }
    var username = document.getElementById("username").value;
    var pass = document.getElementById("password").value;
    var vpn = document.getElementById("message-vpn").value;
    if (!hosturl || !username || !pass || !vpn) {
      subscriber.log(
        "Cannot connect: please specify all the Solace message router properties."
      );
      return;
    }
    subscriber.log("Connecting to Solace message router using url: " + hosturl);
    subscriber.log("Client username: " + username);
    subscriber.log("Solace message router VPN name: " + vpn);
    // create session
    try {
      subscriber.session = solace.SolclientFactory.createSession({
        // solace.SessionProperties
        url: hosturl,
        vpnName: vpn,
        userName: username,
        password: pass
      });
    } catch (error) {
      subscriber.log(error.toString());
    }
    // define session event listeners
    subscriber.session.on(solace.SessionEventCode.UP_NOTICE, function(
      sessionEvent
    ) {
      subscriber.log("=== Successfully connected and ready to subscribe. ===");
    });
    subscriber.session.on(
      solace.SessionEventCode.CONNECT_FAILED_ERROR,
      function(sessionEvent) {
        subscriber.log(
          "Connection failed to the message router: " +
            sessionEvent.infoStr +
            " - check correct parameter values and connectivity!"
        );
      }
    );
    subscriber.session.on(solace.SessionEventCode.DISCONNECTED, function(
      sessionEvent
    ) {
      subscriber.log("Disconnected.");
      subscriber.subscribed = false;
      if (subscriber.session !== null) {
        subscriber.session.dispose();
        subscriber.session = null;
      }
    });
    subscriber.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, function(
      sessionEvent
    ) {
      subscriber.log(
        "Cannot subscribe to topic: " + sessionEvent.correlationKey
      );
    });
    subscriber.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, function(
      sessionEvent
    ) {
      if (subscriber.subscribed) {
        if (subscriber.check) {
          subscriber.subscribed = true;
          subscriber.log(
            "Successfully subscribed to topic: " + sessionEvent.correlationKey
          );
          subscriber.log("=== Ready to receive messages. ===");
        } else {
          subscriber.subscribed = false;
          subscriber.log(
            "Successfully unsubscribed from topic: " +
              sessionEvent.correlationKey
          );
        }
      } else {
        subscriber.subscribed = true;
        subscriber.check = 1;
        subscriber.log(
          "Successfully subscribed to topic: " + sessionEvent.correlationKey
        );
        subscriber.log("=== Ready to receive messages. ===");
      }
    });
    // define message event listener
    subscriber.session.on(solace.SessionEventCode.MESSAGE, function(message) {
      var msg = "";
      try {
        msg = eval("(" + message._binaryAttachment + ")");
      } catch (error) {
        msg = message._binaryAttachment;
        subscriber.log(error.toString());
      }
      console.log(msg);

      if (message._destination.name == "list-new-log") {
        subscriber.updatenewlog(msg);
      }
      if (message._destination.name == "list-new-cfs") {
        subscriber.updatenewcfs(msg);
      }
      if (message._destination.name == "update-cfs") {
        subscriber.updatecfs(msg);
      }
      subscriber.log(
        'Received message: "' +
          message.getBinaryAttachment() +
          '", details:\n' +
          message.dump()
      );
    });

    subscriber.connectToSolace();
  };
  subscriber.updatenewlog = function(data) {
    var html = null;
    if (Array.isArray(data)) {
      for (let item of data) {
        html += `<tr data-id="${item._id}">
                    <th scope="row">${item._id}</th>
                    <td>${item.date}</td >
                    <td>${item.action}</td>
                    <td>${item.email}</td>
                    <td>${item.description}</td>
                  </tr>`;
      }
      $("#cfsLogs")
        .find("tbody")
        .html(html);
    }
  };
  subscriber.updatenewcfs = function(data) {
    var html = null;
    if (Array.isArray(data)) {
      for (let item of data) {
        html += `<tr data-id="${item._id}">
                  <th scope="row">${item._id}</th>
                    <td>${item.name}</td>
                  <td>${item.address}</td >
                  <td>${item.description}</td>
                </tr>`;
      }
      $("#cfsViews")
        .find("tbody")
        .html(html);
    }
  };
  subscriber.updatecfs = function(response) {
    $("#textAddress").val(response.address);
    $("#textName").val(response.name);
    $("#textDescription").val(response.description);
  };
  // Actually connects the session triggered when the iframe has been loaded - see in html code
  subscriber.connectToSolace = function() {
    try {
      subscriber.session.connect();
    } catch (error) {
      subscriber.log(error.toString());
    }
  };

  subscriber.addsubscribe = topPic => {
    setTimeout(() => {
      try {
        console.log(topPic, subscriber);
        subscriber.session.subscribe(
          solace.SolclientFactory.createTopicDestination(topPic),
          true, // generate confirmation when subscription is added successfully
          topPic, // use topic name as correlation key
          10000 // 10 seconds timeout for this operation
        );
      } catch (error) {
        subscriber.log("trieu" + error.toString());
      }
    }, 3000);
  };

  // Subscribes to topic on Solace message router
  subscriber.subscribe = function() {
    const topPic = arguments;
    console.log(topPic);
    if (subscriber.session !== null) {
      if (subscriber.subscribed) {
        subscriber.log(
          'Already subscribed to "' +
            subscriber.topicName +
            '" and ready to receive messages.'
        );
      } else {
        subscriber.log("Subscribing to topic: " + subscriber.topicName);
        try {
          subscriber.session.subscribe(
            solace.SolclientFactory.createTopicDestination(
              subscriber.topicName
            ),
            true, // generate confirmation when subscription is added successfully
            subscriber.topicName, // use topic name as correlation key
            10000 // 10 seconds timeout for this operation
          );
        } catch (error) {
          subscriber.log(error.toString());
        }
      }
    } else {
      subscriber.log(
        "Cannot subscribe because not connected to Solace message router."
      );
    }
  };

  // Unsubscribes from topic on Solace message router
  subscriber.unsubscribe = function() {
    if (subscriber.session !== null) {
      if (subscriber.subscribed) {
        subscriber.log("Unsubscribing from topic: " + subscriber.topicName);
        try {
          subscriber.session.unsubscribe(
            solace.SolclientFactory.createTopicDestination(
              subscriber.topicName
            ),
            true, // generate confirmation when subscription is removed successfully
            subscriber.topicName, // use topic name as correlation key
            10000 // 10 seconds timeout for this operation
          );
        } catch (error) {
          subscriber.log(error.toString());
        }
      } else {
        subscriber.log(
          'Cannot unsubscribe because not subscribed to the topic "' +
            subscriber.topicName +
            '"'
        );
      }
    } else {
      subscriber.log(
        "Cannot unsubscribe because not connected to Solace message router."
      );
    }
  };

  // Gracefully disconnects from Solace message router
  subscriber.disconnect = function() {
    subscriber.log("Disconnecting from Solace message router...");
    if (subscriber.session !== null) {
      try {
        subscriber.session.disconnect();
      } catch (error) {
        subscriber.log(error.toString());
      }
    } else {
      subscriber.log("Not connected to Solace message router.");
    }
  };

  return subscriber;
};
