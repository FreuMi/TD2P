const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3001;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.use(bodyParser.text());

let powerState = false;
let brightness = 0;

app.get("/", (req, res) => {
  const IP = "172.23.220.91:3001";

  const td = {
    "@context": [
      "https://www.w3.org/2022/wot/td/v1.1",
      { "@base": `http://${IP}/` },
    ],
    id: "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    title: "SmartLightBulb",
    securityDefinitions: {
      nosec_sc: {
        scheme: "nosec",
      },
    },
    security: "nosec_sc",
    properties: {
      status: {
        "@id": "powerState",
        type: "boolean",
        readOnly: true,
        writeOnly: false,
        forms: [{ href: `http://${IP}/status` }],
      },
      brightness: {
        "@id": "brightnessState",
        type: "integer",
        writeOnly: true,
        readOnly: false,
        minimum: 0,
        maximum: 255,
        forms: [{ href: `http://${IP}/brightness` }],
        preCondition: {
          "op:booleanEqual": [{ "@id": `powerState` }, true],
        },
      },
    },
    actions: {
      turnOn: {
        forms: [{ href: `http://${IP}/turnOn` }],
        preCondition: {
          "op:booleanEqual": [{ "@id": `powerState` }, false],
        },
        effect: [{ assign: true, to: { "@id": "powerState" } }],
      },
      turnOff: {
        forms: [{ href: `http://${IP}/turnOff` }],
        preCondition: {
          "op:booleanEqual": [{ "@id": `powerState` }, true],
        },
        effect: [{ assign: false, to: { "@id": "powerState" } }],
      },
      increaseBrightnessByValue: {
        input: {
          "@id": "increaseBrightnessInput",
          type: "integer",
          minimum: 1,
          maximum: 10,
        },
        forms: [{ href: `http://${IP}/increaseBrightnessByValue` }],
        preCondition: {
          "op:booleanEqual": [{ "@id": `powerState` }, true],
        },
        effect: [
          {
            assign: {
              "fn:min": [
                255,
                {
                  "op:numeric-add": [
                    { "@id": `brightnessState` },
                    { "@id": "increaseBrightnessInput" },
                  ],
                },
              ],
            },
            to: {
              "@id": "brightnessState",
            },
          },
        ],
      },
    },
  };

  res.send(td);
});

app.get("/status", function (req, res) {
  console.log("Read /status state");
  res.send(powerState);
});

app.post("/turnOn", function (req, res) {
  console.log("Action: turnOn invoked");
  powerState = true;
  res.sendStatus(200);
});

app.post("/turnOff", function (req, res) {
  console.log("Action: turnOff invoked");
  powerState = false;
  res.sendStatus(200);
});

app.post("/turnOff", function (req, res) {
  console.log("Action: turnOff invoked");
  powerState = false;
  res.sendStatus(200);
});

app.post("/increaseBrightnessByValue", function (req, res) {
  let valueToIncrease = 0;
  try {
    valueToIncrease = parseInt(req.body);
    if (!(valueToIncrease > 0 && valueToIncrease < 11)) {
      throw new Error("Parameter is not in valid range");
    }
  } catch {
    res.sendStatus(400);
    return;
  }
  console.log(
    "Action: increaseBrightnessByValue invoked with value",
    valueToIncrease
  );
  brightness += valueToIncrease;
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
