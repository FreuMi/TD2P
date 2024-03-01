const { Servient, ConsumedThing } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");
const fs = require("fs");

const crawler = require("./crawler");

let availableObjectTypes = [];
let availablePredicates = [];
let availableFunctions = [];
let availableActions = [];

let thingID = 0;

function getAllValuesWithKey(obj, key) {
  const result = new Set();

  function search(obj) {
    if (obj !== null && typeof obj === "object") {
      Object.keys(obj).forEach((k) => {
        if (k === key) {
          result.add(obj[k]);
        }
        search(obj[k]);
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => {
        search(item);
      });
    }
  }

  search(obj);

  // Convert the Set to an Array to return the result
  return Array.from(result);
}

// Define the mapping of operation keys to functions
const functions = {
  "op:numeric-add": opAdd,
  "op:numeric-subtract": opSub,
  "op:numeric-multiply": opMul,
  "op:numeric-equal": numEqual,
  "op:boolean-equal": boolEqual,
};

function opSub(element1, element2) {
  // Check if elmenent is number; then use abs
  if (typeof element1 === "number") {
    element1 = Math.abs(element1);
  } else if (typeof element2 === "number") {
    element2 = Math.abs(element2);
  }

  // Generate String
  let resultString = "(- ";

  // Check if element1 is a number
  if (typeof element1 === "number") {
    resultString += `${element1} `;
  } else {
    // Get type of element 1
    let typesElement1 = "";
    let values = getData(element1);
    if (values[0]?.variables) {
      for (const element of values[0]?.variables) {
        typesElement1 += ` ${element}`;
      }
    }
    resultString += `(${element1}${typesElement1}) `;
  }

  // Get type of element 2
  if (typeof element2 === "number") {
    resultString += `${element2} `;
  } else {
    // Get type of element 1
    let typesElement2 = "";
    values = getData(element2);
    if (values[0]?.variables) {
      for (const element of values[0]?.variables) {
        typesElement2 += ` ${element}`;
      }
    }
    resultString += `(${element2}${typesElement2}) `;
  }
  resultString += ")";
  return resultString;
}

function opAdd(element1, element2) {
  // Check if any element is negative
  if (Math.sign(element1) == -1 || Math.sign(element2) == -1) {
    // call subtract method
    return opSub(element1, element2);
  }

  // Generate String
  let resultString = "(+ ";

  // Check if element1 is a number
  if (typeof element1 === "number") {
    resultString += `${element1} `;
  } else {
    // Get type of element 1
    let typesElement1 = "";
    let values = getData(element1);
    if (values[0]?.variables) {
      for (const element of values[0]?.variables) {
        typesElement1 += ` ${element}`;
      }
    }
    resultString += `(${element1}${typesElement1}) `;
  }

  // Get type of element 2
  if (typeof element2 === "number") {
    resultString += `${element2} `;
  } else {
    // Get type of element 1
    let typesElement2 = "";
    values = getData(element2);
    if (values[0]?.variables) {
      for (const element of values[0]?.variables) {
        typesElement2 += ` ${element}`;
      }
    }
    resultString += `(${element2}${typesElement2}) `;
  }
  resultString += ")";
  return resultString;
}

function opMul(element1, element2) {
  return `(* (${element1} ${generatedFunctions.get(
    element1
  )}) (${element2} ${generatedFunctions.get(element2)}))`;
}

function numEqual(element1, element2) {
  let valueElement1 = getData(element1)[0];
  let valueElement2 = getData(element2)[0];

  // Generate return string
  let returnString = "(= ";
  if (typeof element1 === "number") {
    // No types; no braces
    returnString += ` ${element1}`;
  } else {
    returnString += `(${element1}`;
    // Add all variables for first element
    if (valueElement1 != undefined) {
      for (const element of valueElement1.variables) {
        returnString += ` ${element}`;
      }
    }
    returnString += ")";
  }

  // Check if element2 is number
  if (typeof element2 === "number") {
    // No types; no braces
    returnString += ` ${element2}`;
  } else {
    returnString += ` (${element2}`;
    // Add all variables for second element
    if (valueElement2 != undefined) {
      for (const element of valueElement2.variables) {
        returnString += ` ${element}`;
      }
    }
    returnString += ")";
  }

  returnString += ")";

  return returnString;
}

function boolEqual(element1, element2) {
  if (typeof element1 == "boolean") {
    let valueElement2 = getData(element2)[0];
    // Generate result string
    let resultString = `${element2}`;
    if (valueElement2 != undefined) {
      for (const element of valueElement2.variables) {
        resultString += ` ${element}`;
      }
    }
    if (element1) {
      return `(${resultString})`;
    }
    return `(not(${resultString}))`;
  }

  let valueElement1 = getData(element1)[0];
  // Generate result string
  let resultString = `${element1}`;
  if (valueElement1 != undefined) {
    for (const element of valueElement1.variables) {
      resultString += ` ${element}`;
    }
  }
  if (element2) {
    return `(${resultString})`;
  }
  return `(not(${resultString}))`;
}

function parse(node) {
  if (typeof node === "object") {
    if (node["@id"]) {
      // Directly return the identifier if the object is an @id reference
      return node["@id"];
    } else {
      // If the object is an operation, process accordingly
      const key = Object.keys(node)[0];
      // Skip processing "fn:min" directly and find the nested operation or object to process
      if (key === "fn:min") {
        // Assume the nested operation we care about is the second element in the array for "fn:min"
        const nestedNode = node[key][1];
        return parse(nestedNode); // Parse the nested operation
      } else if (functions[key]) {
        // Process recognized operations with their corresponding functions
        return functions[key](...node[key].map(parse));
      }
    }
  } else if (Array.isArray(node)) {
    // Process each element in the array
    return node.map(parse).join(", ");
  }
  // Return literals directly
  return node;
}

function parseCondition(node) {
  if (typeof node == "object") {
    if (node["@id"]) {
      // Directly return the identifier if the object is an @id reference
      return node["@id"];
    }

    const key = Object.keys(node)[0];
    if (key === "and") {
      // Process all elements in the array for "and"
      // and wrap them with "and" prefix
      return `(and ${node[key].map(parse).join(" ")})`;
    }
    if (functions[key]) {
      // Process recognized operations with their corresponding functions
      return functions[key](...node[key].map(parse));
    }
  }
  // Handle basic types
  if (Array.isArray(node)) {
    return node.map(parse).join(", ");
  }
  if (Number.isInteger(node) || typeof node == "boolean") {
    return node;
  }
  return "";
}

// Currently only handels one
function evalEffect(statements) {
  const statement = statements[0];

  const assignValue = statement.assign;
  const identifier = statement.to["@id"];

  // If only boolean handle it
  if (typeof assignValue == "boolean") {
    return assignValue
      ? `${identifier} ?thing${thingID}`
      : `not(${identifier} ?thing${thingID})`;
  }
  // Else handle more complex parsing
  const resultAssign = parse(assignValue);

  // Get variables
  let types = "";
  values = getData(identifier);
  for (const element of values[0].variables) {
    types += ` ${element}`;
  }

  return `assign (${identifier} ${types}) ${resultAssign}`;
}

function getFunctionInformation(name) {
  for (const element of availableFunctions) {
    if (element.name == name) {
      return element;
    }
  }

  return [];
}

function getPredicateInformation(name) {
  for (const element of availablePredicates) {
    if (element.name == name) {
      return element;
    }
  }

  return [];
}

function getData(name) {
  let result = [];
  result = result.concat(getFunctionInformation(name));
  result = result.concat(getPredicateInformation(name));

  return result;
}

function evalCondition(statement) {
  if (statement == undefined || Object.keys(statement).length == 0) {
    // undefined means not found -> empty
    return "";
  }
  const value = parseCondition(statement);
  // Remove braces for easier formatting
  const x = value.substring(1, value.length - 1);

  return x;
}

function generateActions(td) {
  ///////////////////////////////////////////////
  // Generate PDDL actions for readProperties //
  //////////////////////////////////////////////
  for (const property in td.properties) {
    if (
      td.properties[property].readOnly == false ||
      td.properties[property].readOnly == undefined
    ) {
      continue;
    }

    // For read properties parameters is always Thing object
    const parameters = `?thing${thingID} - Thing${thingID}`;
    const preCondition = evalCondition(td.properties[property].preCondition);
    // Effect for read properties is always that @id_Read is set to true
    const id = td.properties[property]["@id"];
    const effect = `${id}_Read ?thing${thingID}`;

    availableActions.push({
      name: `readProperty_${property}`,
      params: parameters,
      pre: preCondition,
      effect: effect,
    });
  }

  ///////////////////////////////////////////////
  // Generate PDDL actions for writeProperties //
  ///////////////////////////////////////////////

  // TODO: Integer/Float

  /////////////////////////////////////
  // Generate Actions with no input //
  ////////////////////////////////////
  for (const action in td.actions) {
    if (td.actions[action].input != undefined) {
      continue;
    }
    // Get variables and types
    const ids = getAllValuesWithKey(td.actions[action], "@id");
    let parameters = "";

    for (const element of ids) {
      const values = getData(element)[0];
      for (let i = 0; i < values.types.length; i++) {
        parameters += ` ${values.variables[i]} - ${values.types[i]}`;
      }
    }

    // Eval given preconditon
    const preCondition = evalCondition(td.actions[action].preCondition);
    // Eval given effect
    const effect = evalEffect(td.actions[action].effect);

    availableActions.push({
      name: `invokeAction_${action}`,
      params: parameters,
      pre: preCondition,
      effect: effect,
    });
  }

  ///////////////////////////////////
  // Generate Actions with input  //
  //////////////////////////////////
  for (const action in td.actions) {
    // If properties are not write only
    if (
      td.actions[action].input == undefined ||
      td.actions[action]?.input?.type != "integer"
    ) {
      continue;
    }

    // Cover all other references @id then input
    const ids = getAllValuesWithKey(td.actions[action], "@id");
    let parameters = "";
    const added = []; // Keep track of added data
    for (const element of ids) {
      const values = getData(element);
      if (values.length === 0) {
        continue;
      }

      for (let i = 0; i < values[0].types.length; i++) {
        if (!added.includes(values[0].variables[i])) {
          parameters += ` ${values[0].variables[i]} - ${values[0].types[i]}`;
          added.push(values[0].variables[i]);
        }
      }
    }

    // Assume: Only one post condition
    const max = td.actions[action].input.maximum;
    const min = td.actions[action].input.minimum;
    const inputVariable = td.actions[action].input["@id"];

    for (let j = min; j <= max; j++) {
      const preCondition = evalCondition(td.actions[action].preCondition);
      // Create a deep copy of effectInput to ensure modifications are isolated to each iteration
      let effectInput = JSON.parse(
        JSON.stringify(td.actions[action].effect[0])
      );

      for (let key in effectInput.assign) {
        // Check if the property is an array
        if (Array.isArray(effectInput.assign[key])) {
          // Find the index of the object with "@id": inputVariable
          const index = effectInput.assign[key].findIndex(
            (element) => element["@id"] === inputVariable
          );
          // Check if the index was found
          if (index !== -1) {
            effectInput.assign[key][index] = j;
            break;
          }
        }
      }

      const effect = evalEffect([effectInput]);

      availableActions.push({
        name: `invokeAction_${action}_${j}`,
        params: parameters,
        pre: preCondition,
        effect: effect,
      });
    }
  }
}

function generateFunctions(td) {
  ///////////////////////////////
  /// MODEL VALUE OF PROPERTY ///
  ///////////////////////////////

  // Add all properties that have type integer
  // Name is just "@id"
  for (const property in td.properties) {
    // If property is readOnly=false or undefined
    if (td.properties[property].type != "integer") {
      continue;
    }

    const id = td.properties[property]["@id"];
    const name = id;
    const propertyType = [`Thing${thingID}`];
    const propertyTypeVariable = [`?thing${thingID}`];

    // Add data with name, types, and variable names
    availableFunctions.push({
      name: name,
      types: propertyType,
      variables: propertyTypeVariable,
    });
  }

  // TODO: Float
}

function generatePredicates(td) {
  const generatedPredicates = new Set();

  // Add property read indicator to predicates
  // Name == @id + suffix "_Read"
  for (const property in td.properties) {
    // If property is readOnly=false or undefined
    if (
      td.properties[property].readOnly == false ||
      td.properties[property].readOnly == undefined
    ) {
      continue;
    }

    const id = td.properties[property]["@id"];
    const name = `${id}_Read`;
    const propertyType = [`Thing${thingID}`];
    const propertyTypeVariable = [`?thing${thingID}`];

    // Add data with name, types, and variable names
    availablePredicates.push({
      name: name,
      types: propertyType,
      variables: propertyTypeVariable,
    });
  }

  // Add boolean properties
  // Name == "@id"
  for (const property in td.properties) {
    // If properties type is boolean
    if (td.properties[property].type != "boolean") {
      continue;
    }

    const name = td.properties[property]["@id"];
    const propertyType = [`Thing${thingID}`];
    const propertyTypeVariable = [`?thing${thingID}`];

    // Add data with name, types, and variable names
    availablePredicates.push({
      name: name,
      types: propertyType,
      variables: propertyTypeVariable,
    });
  }

  // TODO?: Add action invoked indicator to predicates for actions with output
}

function generateObjectTypes(td) {
  const generatedObjectTypes = new Set();

  // one object type is always "Thing"
  generatedObjectTypes.add(`Thing${thingID}`);

  // convert set to array
  availableObjectTypes = availableObjectTypes.concat(
    Array.from(generatedObjectTypes)
  );
}

function createDomainTemplate(domainName) {
  let template = `
    (define (domain ${domainName})
    (:requirements :strips :typing :fluents)
    <!--types-->
    <!--predicates-->
    <!--functions-->
    <!--actions-->
    )
    `;

  // Generate Object Types
  let objectTypeString = "(:types ";
  for (const objectType of availableObjectTypes) {
    objectTypeString += `${objectType} `;
  }
  objectTypeString += ")\n";
  template = template.replace("<!--types-->", objectTypeString);

  // Generate predicates
  const addedPredicates = [];
  let predicateString = "(:predicates\n";
  for (const predicate of availablePredicates) {
    for (let i = 0; i < predicate.types.length; i++) {
      if (
        !addedPredicates.includes(`${predicate.name}${predicate.variables[i]}`)
      ) {
        predicateString += "(";
        predicateString += ` ${predicate.name} ${predicate.variables[i]} - ${predicate.types[i]}`;
        predicateString += ")\n";

        addedPredicates.push(`${predicate.name}${predicate.variables[i]}`);
      }
    }
  }
  predicateString += ")\n";
  template = template.replace("<!--predicates-->", predicateString);

  // Generate functions
  const addedFunctions = [];
  let functionString = "(:functions\n";
  for (const functionName of availableFunctions) {
    functionString += `(${functionName.name}`;

    for (let i = 0; i < functionName.types.length; i++) {
      if (
        !addedFunctions.includes(
          `${functionName.name}${functionName.variables[i]}`
        )
      ) {
        functionString += ` ${functionName.variables[i]} - ${functionName.types[i]}`;

        addedFunctions.push(`${functionName.name}${functionName.variables[i]}`);
      }
    }
    functionString += ")\n";
  }
  functionString += ")\n";
  template = template.replace("<!--functions-->", functionString);

  // Generate Actions
  let actionString = "";
  for (const action of availableActions) {
    actionString += `(:action ${action.name}\n:parameters(${action.params})\n:precondition(${action.pre})\n:effect(${action.effect})\n)\n`;
  }
  template = template.replace("<!--actions-->", actionString);

  return template;
}

function generateDomain(foundTDs) {
  // Generate all object Types
  for (let i = 0; i < foundTDs.length; i++) {
    const td = foundTDs[i]; // Get TD
    thingID = i; // Set Thing ID
    generateObjectTypes(td);
  }
  //console.log("Types:", availableObjectTypes);
  console.log("Generated Object Types.");

  // Generate all predicates
  for (let i = 0; i < foundTDs.length; i++) {
    const td = foundTDs[i];
    thingID = i;
    generatePredicates(td);
  }
  //console.log("Predicates:", availablePredicates);
  console.log("Generated Predicates.");

  // Generate all functions
  for (let i = 0; i < foundTDs.length; i++) {
    const td = foundTDs[i];
    thingID = i;
    generateFunctions(td);
  }
  //console.log("Functions:", availableFunctions);
  console.log("Generated Functions.");

  // Generate all actions
  for (let i = 0; i < foundTDs.length; i++) {
    const td = foundTDs[i];
    thingID = i;
    generateActions(td);
  }
  //console.log("Actions", availableActions);
  console.log("Generated Actions.");
}

///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////

const availableObjects = [];
const availableInitialValues = [];

const addedInitialValues = [];

function generateObjects(td) {
  // One object representing the Thing
  availableObjects.push({
    name: td.title,
    type: `Thing${thingID}`,
  });
}

async function initValues(thing, predefinedValues, td) {
  // Get current values of all read properties
  for (const propertyName in td.properties) {
    if (td.properties[propertyName].writeOnly == true) {
      continue;
    }

    // check if already added
    if (addedInitialValues.includes(`${propertyName}${td.title}`)) {
      continue;
    }

    const response = await thing.readProperty(propertyName);
    const value = await response.value();

    availableInitialValues.push({
      name: td.properties[propertyName]["@id"],
      value: value,
      thing: td.title,
    });

    addedInitialValues.push(`${propertyName}${td.title}`);
  }

  // For all predicates with suffix _Read: Add init value false
  for (const element of availablePredicates) {
    // check if already added
    if (addedInitialValues.includes(`${element.name}${false}`)) {
      continue;
    }
    if (element.name.endsWith("_Read")) {
      availableInitialValues.push({
        name: element.name,
        value: false,
        thing: td.title,
      });
    }
    addedInitialValues.push(`${element.name}${false}`);
  }

  // Analyze initialValues
  const keys = Object.keys(predefinedValues);
  for (const key of keys) {
    availableInitialValues.push({
      name: key,
      value: predefinedValues[key],
      thing: td.title,
    });
  }
}

function createProblemTemplate(domainName, problemName, goal) {
  let template = `
  (define (problem ${problemName})
  (:domain ${domainName})
  <!--objects-->
  <!--init-->
  (:goal
    ${goal}
  )
  )
  `;

  // Add objects
  let objectString = "(:objects \n";
  for (const object of availableObjects) {
    objectString += `${object.name} - ${object.type}\n`;
  }
  objectString += ")\n";
  template = template.replace("<!--objects-->", objectString);

  // Add initial values
  let initialValuesString = "(:init \n";
  for (const initValue of availableInitialValues) {
    // Check type
    if (typeof initValue.value === "boolean") {
      if (initValue.value) {
        initialValuesString += `(${initValue.name} ${initValue.thing})\n`;
        continue;
      }
      initialValuesString += `(not (${initValue.name} ${initValue.thing}))\n`;
    } else {
      // type is number
      initialValuesString += `(= (${initValue.name} ${initValue.thing}) ${initValue.value})\n`;
    }
  }
  initialValuesString += ")\n";
  template = template.replace("<!--init-->", initialValuesString);

  return template;
}

async function generateProblem(foundTDs, WoT, predefinedValues) {
  // Generate Objects
  for (let i = 0; i < foundTDs.length; i++) {
    const td = foundTDs[i];
    thingID = i;
    generateObjects(td);
  }
  //console.log(availableObjects);
  console.log("Generated Objects.");

  // Get initial values
  for (let i = 0; i < foundTDs.length; i++) {
    const td = foundTDs[i];
    thingID = i;
    const thing = await WoT.consume(td);
    await initValues(thing, predefinedValues, td);
  }
  //console.log(availableInitialValues);
  console.log("Generated Initial Values.");
}

///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////
function writeFiles(domainFile, problemFile) {
  fs.writeFileSync("generatedDomain", domainFile);
  fs.writeFileSync("generatedProblem", problemFile);
}

async function main() {
  const servient = new Servient();
  servient.addClientFactory(new HttpClientFactory(null));

  servient
    .start()
    .then(async (WoT) => {
      // Initial Config Values
      const initialTD = "http://172.17.187.244:3001/doorTd";
      const domainName = "myDomain";
      const problemName = "myProblem";
      const goal = "(doorOpenState DoorController)";
      const predefinedValues = {};

      // Get all linked TDs using the crawler
      const foundTDs = Array.from(await crawler.crawl(initialTD));

      // Extract all Domain information of found TDs
      generateDomain(foundTDs);

      // Extract all Problem Information of the TD and the Thing
      await generateProblem(foundTDs, WoT, predefinedValues);

      // Generate one domain and one problem file involving all Things
      const domainFile = createDomainTemplate(domainName);
      const problemFile = createProblemTemplate(domainName, problemName, goal);

      writeFiles(domainFile, problemFile);
      console.log("Successfully Completed!");
    })
    .catch((err) => {
      console.error(err);
    });
}

main();
