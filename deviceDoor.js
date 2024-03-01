const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3001;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.use(bodyParser.text());

let openState = false;

app.get("/doorTd", (req, res) => {
  const IP = "172.17.187.244:3001";

  const td = {
    "@context": [
      "https://www.w3.org/2022/wot/td/v1.1",
      { "@base": `http://${IP}/` },
    ],
    id: "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    title: "DoorController",
    securityDefinitions: {
      nosec_sc: {
        scheme: "nosec",
      },
    },
    security: "nosec_sc",
    links: [
      {
        href: "http://172.17.187.244:3001/powerSupplyTd",
        type: "application/td+json",
      },
    ],
    properties: {
      openState: {
        "@id": "doorOpenState",
        type: "boolean",
        readOnly: true,
        writeOnly: false,
        forms: [{ href: `http://${IP}/openState` }],
      },
    },
    actions: {
      open: {
        forms: [{ href: `http://${IP}/open` }],
        preCondition: {
          and: [
            { "op:numeric-equal": [{ "@id": `outputVoltage` }, 5] },
            { "op:boolean-equal": [{ "@id": "doorOpenState" }, false] },
          ],
        },
        effect: [{ assign: true, to: { "@id": "doorOpenState" } }],
      },
      close: {
        forms: [{ href: `http://${IP}/close` }],
        preCondition: {
          and: [
            { "op:numeric-equal": [{ "@id": `outputVoltage` }, 5] },
            { "op:boolean-equal": [{ "@id": "doorOpenState" }, true] },
          ],
        },
        effect: [{ assign: false, to: { "@id": "doorOpenState" } }],
      },
    },
  };

  res.setHeader("content-type", "application/td+json");
  res.send(td);
});

app.get("/openState", function (req, res) {
  console.log("Read /openState state of door");
  res.send(openState);
});

app.post("/open", function (req, res) {
  console.log("Action: open invoked of door");
  openState = true;
  res.sendStatus(200);
});

app.post("/close", function (req, res) {
  console.log("Action: close invoked of door");
  openState = false;
  res.sendStatus(200);
});

//////////////////
////// TD2 ///////
/////////////////

const outputVoltage = 0;

app.get("/powerSupplyTd", (req, res) => {
  const IP = "172.17.187.244:3001";

  const td = {
    "@context": [
      "https://www.w3.org/2022/wot/td/v1.1",
      { "@base": `http://${IP}/` },
    ],
    id: "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    title: "PowerSupply",
    securityDefinitions: {
      nosec_sc: {
        scheme: "nosec",
      },
    },
    security: "nosec_sc",
    properties: {
      outputVoltage: {
        "@id": "outputVoltage",
        type: "integer",
        readOnly: true,
        writeOnly: false,
        forms: [{ href: `http://${IP}/outputVoltage` }],
      },
    },
    actions: {
      changeVoltageByValue: {
        input: {
          "@id": "changeVoltageInput",
          type: "integer",
          minimum: -10,
          maximum: 10,
        },
        forms: [{ href: `http://${IP}/changeVoltageValue` }],
        preCondition: {},
        effect: [
          {
            assign: {
              "op:numeric-add": [
                { "@id": `outputVoltage` },
                { "@id": "changeVoltageInput" },
              ],
            },
            to: {
              "@id": "outputVoltage",
            },
          },
        ],
      },
    },
  };

  res.setHeader("content-type", "application/td+json");
  res.send(td);
});

app.get("/outputVoltage", function (req, res) {
  console.log("Read /outputVoltage state of power supply");
  res.send(outputVoltage.toString());
});

app.post("/changeVoltageValue", function (req, res) {
  console.log("Action: changeVoltageByValue invoked of power supply");
  valueToIncrease = parseInt(req.body);
  outputVoltage = outputVoltage + valueToIncrease;
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
