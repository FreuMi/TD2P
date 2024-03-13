const { exec } = require("child_process");

const wotTemplate = `const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

<!--TDs-->

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory(null));

servient.start().then(async (WoT) => {
    <!--ConsumeTDs-->
    <!--WoTCode-->
}).catch((err) => { console.error(err); });`;

function getThingTitleByInteraction(foundTDs, interaction) {
  // Find thing title for found
  let tdId = 0;
  for (const td of foundTDs) {
    const properties = Object.keys(td.properties);
    const actions = Object.keys(td.actions);

    if (properties.includes(interaction) || actions.includes(interaction)) {
      return tdId;
    }

    tdId++;
  }
}

function fillInWotTemplate(tds, consumeTdOperations, wotCommands) {
  // Convert sets to arrays
  const tdsArr = Array.from(tds);
  const consumeTdOperationsArr = Array.from(consumeTdOperations);
  // Fill in template and return
  let template = wotTemplate;

  // Generate TD string
  let tdString = "";
  for (const element of tdsArr) {
    tdString += element + "\n";
  }
  template = template.replace("<!--TDs-->", tdString);

  let consumeTdString = "";
  for (const element of consumeTdOperationsArr) {
    consumeTdString += element + "\n";
  }
  template = template.replace("<!--ConsumeTDs-->", consumeTdString);

  let wotInteractionString = "";
  for (const element of wotCommands) {
    wotInteractionString += element + "\n";
  }
  template = template.replace("<!--WoTCode-->", wotInteractionString);

  return template;
}

function parsePlannerOutput(foundTDs, resultLines) {
  const tds = new Set();
  const consumeTdOperations = new Set();
  const wotCommands = [];

  // Iterate over all result lines
  for (const line of resultLines) {
    // Remove unnneded output
    const regex = /\(([^)]+)\)/;
    const matches = line.match(regex);
    if (!(matches && matches[1])) {
      continue;
    }
    // Split by " "
    const command_to_parse = matches[1].split(" ")[0];
    const command_parts = command_to_parse.split("_");
    const thingID = getThingTitleByInteraction(foundTDs, command_parts[1]);
    const inputValue = command_parts[2];
    const interactionType = command_parts[0];

    // Add thing to tds
    tds.add(`const td${thingID} = ${JSON.stringify(foundTDs[thingID])};`);

    // Add thing to consume operation
    consumeTdOperations.add(
      `const ${foundTDs[thingID].title} = await WoT.consume(td${thingID});`
    );

    // add wot command
    if (typeof inputValue != "undefined") {
      wotCommands.push(
        `${foundTDs[thingID].title}.${interactionType}("${command_parts[1]}", ${inputValue});`
      );
    } else {
      wotCommands.push(
        `${foundTDs[thingID].title}.${interactionType}("${command_parts[1]}");`
      );
    }
  }

  return fillInWotTemplate(tds, consumeTdOperations, wotCommands);
}

function executePlanner(foundTDs) {
  return new Promise((resolve, reject) => {
    const resultLines = [];
    let recordFlag = false;
    // Execute PDDL planner
    exec(
      "java -jar ./nbdist/enhsp-19.jar -o generatedDomain -f generatedProblem",
      (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        stdout.split("\n").forEach((line) => {
          if (line) {
            // avoids printing empty lines
            if (line == "Problem Solved") {
              recordFlag = true;
              return;
            }
            if (line.startsWith("Plan-Length:")) {
              recordFlag = false;
              return;
            }
            if (recordFlag == true) {
              resultLines.push(line);
            }
          }
        });
        if (stderr) {
          console.log(`stderr: ${stderr}`);
        }
        // transform parsed lines into WoT
        resolve(parsePlannerOutput(foundTDs, resultLines));
      }
    );
  });
}

module.exports = {
  executePlanner: executePlanner,
};
