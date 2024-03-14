const express = require("express");
const bodyParser = require("body-parser");
const process = require("process");
const app = express();
const port = 3001;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.use(bodyParser.text());

let openState = false;

app.get("/doorTd", (req, res) => {
  const IP = "localhost:3001";

  const td = {
    "@context": [
      "https://www.w3.org/2022/wot/td/v1.1",
      {
        "@base": `http://${IP}/`,
        and: "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#logicalAndParameter",
        booleanEqual:
          "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#booleanEqualParameter",
        numericEqual:
          "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#numericEqualParameter",
        to: "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasTarget",
        assign: "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasAssignment",
        effect: "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasEffect",
        precondition:
          "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasPrecondition",
      },
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
        href: `http://${IP}/powerSupplyTd`,
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
        precondition: {
          and: [
            { numericEqual: [{ "@id": `outputVoltage` }, 5] },
            { booleanEqual: [{ "@id": "doorOpenState" }, false] },
          ],
        },
        effect: [{ assign: true, to: { "@id": "doorOpenState" } }],
      },
      close: {
        forms: [{ href: `http://${IP}/close` }],
        precondition: {
          and: [
            { numericEqual: [{ "@id": `outputVoltage` }, -5] },
            { booleanEqual: [{ "@id": "doorOpenState" }, true] },
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
  console.log("Read 'openState' state of door");
  res.send(openState);
});

app.post("/open", function (req, res) {
  openState = true;
  console.log("Action: 'open' invoked of door | New openState:", openState);
  res.sendStatus(200);
});

app.post("/close", function (req, res) {
  openState = false;
  console.log("Action: 'close' invoked of door | New openState:", openState);
  res.sendStatus(200);
});

//////////////////
////// TD2 ///////
/////////////////

let outputVoltage = 0;

app.get("/powerSupplyTd", (req, res) => {
  const IP = "localhost:3001";

  const td = {
    "@context": [
      "https://www.w3.org/2022/wot/td/v1.1",
      {
        "@base": `http://${IP}/`,
        to: "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasTarget",
        assign: "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasAssignment",
        effect: "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasEffect",
        numericAdd:
          "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#numericAddParameter",
        precondition:
          "https://paul.ti.rw.fau.de/~jo00defe/voc/spa#hasPrecondition",
      },
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
        precondition: {},
        effect: [
          {
            assign: {
              numericAdd: [
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
  console.log("Read 'outputVoltage' state of power supply");
  res.setHeader("content-type", "application/json");
  res.send(outputVoltage.toString());
});

app.post(
  "/changeVoltageValue",
  bodyParser.raw({ type: "application/json" }),
  function (req, res) {
    valueToIncrease = parseInt(req.body);
    outputVoltage = outputVoltage + valueToIncrease;
    console.log(
      "Action: 'changeVoltageByValue' invoked of power supply input:",
      valueToIncrease,
      "| New voltage = ",
      outputVoltage
    );
    res.sendStatus(200);
  }
);

app.listen(port, () => {
  console.log(`Devices ready at port ${port}`);
});
