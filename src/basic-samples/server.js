var solace = require("solclientjs").debug; // logging supported
var TopicPublisher = require("./TopicPublisher.js");
var express = require("express");
var MongoClient = require("mongodb");
const assert = require("assert");
var bodyParser = require("body-parser");
var autoIncrement = require("mongodb-autoincrement");
var moment = require("moment");

// Initialize factory with the most recent API defaults
var factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10;
solace.SolclientFactory.init(factoryProps);

// enable logging to JavaScript console at WARN level
// NOTICE: works only with ('solclientjs').debug
solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

// create the publisher, specifying the name of the subscription topic
var publisher = TopicPublisher.TopicPublisher(solace, "tutorial/topic");
publisher.connect(process.argv);
// publish message to Solace message router
// publisher.run(process.argv);

const HOST = "45.63.0.193";//"localhost";
const URL_DB = `mongodb://${HOST}:27017`;
const NAME_DB = "cfs";
var app = express();

app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
  bodyParser.urlencoded({
    // to support URL-encoded bodies
    extended: true
  })
);

app.use("/assets", express.static("assets"));
app.all("/*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/fe/cfs.html");
});

app.get("/load-cfs-view", (req, res) => {
  MongoClient.connect(URL_DB, { useNewUrlParser: true }, function(err, client) {
    assert.equal(null, err);
    const db = client.db(NAME_DB);
    const collection = db.collection("cfs_lists");
    collection
      .find({})
      .sort({ _id: -1 })
      .toArray(function(err, result) {
        assert.equal(err, null);
        client.close();
        res.json(result);
      });
  });
});
app.get("/load-cfs-log", (req, res) => {
  MongoClient.connect(URL_DB, { useNewUrlParser: true }, function(err, client) {
    assert.equal(null, err);
    const db = client.db(NAME_DB);
    const collection = db.collection("logs");
    collection
      .find({})
      .sort({ _id: -1 })
      .toArray(function(err, result) {
        assert.equal(err, null);
        client.close();
        res.json(result);
      });
  });
});
app.post("/load-cfs-view-id", (req, res) => {
  // const id = req.body.id;
  const _id = req.body.id;
  MongoClient.connect(URL_DB, { useNewUrlParser: true }, function(err, client) {
    assert.equal(null, err);
    const db = client.db(NAME_DB);
    const collection = db.collection("cfs_lists");
    var query = { _id: parseInt(_id) };
    collection.findOne(query, function(err, result) {
      res.json(result);
    });
  });
});
app.post("/update-cfs", (rep, response) => {
  const email = rep.body.email;
  const m = rep.body;
  delete m["email"];
  MongoClient.connect(URL_DB, { useNewUrlParser: true }, function(err, client) {
    assert.equal(null, err);
    const db = client.db(NAME_DB);
    const collection = db.collection("cfs_lists");
    var query = { _id: parseInt(m._id) };
    collection.findOne(query, function(err, result) {
      assert.equal(err, null);
      Object.keys(m).forEach(function(key) {
        if (key === "_id") {
          result[key] = parseInt(m[key]);
        } else {
          result[key] = m[key];
        }
      });
      const update = result;
      collection.updateOne({ _id: parseInt(m._id) }, { $set: update }, function(
        err,
        result
      ) {
        assert.equal(err, null);
        collection.find({}).sort({ _id: -1 }).toArray(function(err, result) {
          assert.equal(err, null);
          autoIncrement.getNextSequence(db, "logid", (err, autoIndex) => {
            const log = {
              _id: autoIndex,
              date: moment().format(),
              action: "update",
              email: email,
              description: `update ` + JSON.stringify(update)
            };
            const collectionLog = db.collection("logs");
            collectionLog.insert(log, (err, res) => {
              assert.equal(null, err);
              collectionLog
                .find({})
                .sort({ _id: -1 })
                .toArray(function(err, resultlog) {
                  assert.equal(err, null);
                  // io.emit("list-new-log", resultlog);
                  // publisher.run(process.argv);
                  publisher.publish(JSON.stringify(resultlog), "list-new-log");
                  response.json(resultlog);
                  client.close();
                });
            });
          });
          publisher.publish(JSON.stringify(result), "list-new-cfs");
          // io.emit("list-new-cfs", result);
        });
        publisher.publish(JSON.stringify(update), "update-cfs");
        // io.emit("update-cfs", update);
      });
    });
  });
});

app.post("/create-cfs", (rep, response) => {
  const email = rep.body.email;
  MongoClient.connect(URL_DB, { useNewUrlParser: true }, function(err, client) {
    assert.equal(null, err);
    const db = client.db(NAME_DB);
    autoIncrement.getNextSequence(db, "cfsid", (err, autoIndex) => {
      const dataInsert = {
        _id: autoIndex,
        address: "",
        name: "",
        description: ""
      };
      const collection = db.collection("cfs_lists");
      collection.insert(dataInsert, (err, res) => {
        assert.equal(null, err);
        collection
          .find({})
          .sort({ _id: -1 })
          .toArray(function(err, result) {
            assert.equal(err, null);
            autoIncrement.getNextSequence(db, "logid", (err, autoIndex) => {
              const log = {
                _id: autoIndex,
                date: moment().format(),
                action: "insert",
                email: email,
                description: "insert f10"
              };
              const collectionLog = db.collection("logs");
              collectionLog.insert(log, (err, res) => {
                assert.equal(null, err);
                collectionLog
                  .find({})
                  .sort({ _id: -1 })
                  .toArray(function(err, resultlog) {
                    assert.equal(err, null);
                    dataInsert.listcfslog = resultlog;
                    dataInsert.listcfsviews = result;
                    publisher.publish(
                      JSON.stringify(resultlog),
                      "list-new-log"
                    );
                    publisher.publish(JSON.stringify(result), "list-new-cfs");
                    response.json(dataInsert);
                    client.close();
                  });
              });
            });
          });
      });
    });
  });
});
var server = app.listen(4000, function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log(
    "Ung dung Node.js dang hoat dong tai dia chi: http://%s:%s",
    host,
    port
  );
});

