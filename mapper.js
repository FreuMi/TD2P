const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

let availableObjectTypes = [];
let availablePredicates = [];
let availableFunctions = [];
let availableActions = [];

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
  "op:numeric-multiply": opMul,
};

function opAdd(element1, element2) {
  // Get type of element 1
  let typesElement1 = "";
  let values = getData(element1);
  for (const element of values[0].variables) {
    typesElement1 += ` ${element}`;
  }
  // Get type of element 2
  let typesElement2 = "";
  values = getData(element2);
  for (const element of values[0].variables) {
    typesElement2 += ` ${element}`;
  }
  return `(+ (${element1} ${typesElement1}) (${element2} ${typesElement2}))`;
}

function opMul(element1, element2) {
  return `(* (${element1} ${generatedFunctions.get(
    element1
  )}) (${element2} ${generatedFunctions.get(element2)}))`;
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

// Currently only handels one
function evalEffect(statements) {
  const statement = statements[0];

  const assignValue = statement.assign;
  const identifier = statement.to["@id"];

  // If only boolean handle it
  if (typeof assignValue == "boolean") {
    return assignValue ? `${identifier} ?thing` : `not(${identifier} ?thing)`;
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
  if (statement == undefined) {
    // undefined means not found -> empty
    return "";
  }

  // Extract operation and operands
  const operation = Object.keys(statement)[0];
  const operands = statement[operation];

  let identifier, booleanValue;
  for (const operand of operands) {
    if (typeof operand === "object" && "@id" in operand) {
      identifier = operand["@id"];
    } else if (typeof operand === "boolean") {
      booleanValue = operand;
    }
  }

  // Map based on the operation
  switch (operation) {
    case "op:booleanEqual":
      // Translate to the identifier or its negation
      return booleanValue
        ? `${identifier} ?thing`
        : `not(${identifier} ?thing)`;
    default:
      // Handle other operations or throw an error
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

function generateActions(td, functions) {
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
    const parameters = "?thing - Thing";
    const preCondition = evalCondition(td.properties[property].preCondition);
    // Effect for read properties is always that @id_Read is set to true
    const id = td.properties[property]["@id"];
    const effect = `${id}_Read ?thing`;

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
  for (const property in td.properties) {
    if (
      td.properties[property].readOnly == true ||
      td.properties[property].readOnly == undefined
    ) {
      continue;
    }

    // Handle integer //
    if (td.properties[property].type == "integer") {
      const id = td.properties[property]["@id"];
      // Parameters are input value + Thing
      const values = getData(`${id}`)[0];
      let parameters = "";
      for (let i = 0; i < values.types.length; i++) {
        parameters += ` ${values.variables[i]} - ${values.types[i]}`;
      }
      const preCondition = evalCondition(td.properties[property].preCondition);
      // Effect for write properties is always an value assignment of the input to the property
      let effect = `assign (${id} ?thing)(${id}`;
      for (const element of values.variables) {
        // Add variables
        effect += ` ${element}`;
      }
      effect += ")";

      availableActions.push({
        name: `writeProperty_${property}`,
        params: parameters,
        pre: preCondition,
        effect: effect,
      });
    }

    // TODO: Float/Number
  }

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

    // Cover all other references @id than input
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

    // One parameter for the input
    const id = td.actions[action].input["@id"];
    // Parameters are input value + Thing
    const values = getData(`${id}`)[0];
    for (let i = 0; i < values.types.length; i++) {
      if (!added.includes(values.variables[i])) {
        parameters += ` ${values.variables[i]} - ${values.types[i]}`;
      }
    }

    // Assume: Only one post condition
    const targetID = td.actions[action].effect[0].to["@id"];
    const preCondition = evalCondition(td.actions[action].preCondition);
    const effect = evalEffect(td.actions[action].effect);

    availableActions.push({
      name: `invokeAction_${action}`,
      params: parameters,
      pre: preCondition,
      effect: effect,
    });
  }
}

function generateFunctions(td) {
  let counterInputValues = 0;

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
    const propertyType = ["Thing"];
    const propertyTypeVariable = ["?thing"];

    // Add data with name, types, and variable names
    availableFunctions.push({
      name: name,
      types: propertyType,
      variables: propertyTypeVariable,
    });
  }

  // TODO: Float

  ///////////////////////////////
  /// MODEL INPUT OF PROPERTY ///
  ///////////////////////////////

  // Add function for write properties with input values of type integer
  // Name == @id
  for (const property in td.properties) {
    if (
      td.properties[property].type != "integer" ||
      td.properties[property].writeOnly != true
    ) {
      continue;
    }

    const id = td.properties[property]["@id"];
    const name = `${id}_input`;
    const propertyType = ["Thing", "integer"];
    const propertyTypeVariable = ["?thing", `?v${counterInputValues++}`];

    availableFunctions.push({
      name: name,
      types: propertyType,
      variables: propertyTypeVariable,
    });
  }

  // Add function for actions with input values of type integer
  // Name == "input.@id"
  for (const action in td.actions) {
    if (td.actions[action]?.input?.type != "integer") {
      continue;
    }

    const id = td.actions[action].input["@id"];
    const name = `${id}`;
    const propertyType = ["Thing", "integer"];
    const propertyTypeVariable = ["?thing", `?v${counterInputValues++}`];

    // Add data with name, types, and variable names
    availableFunctions.push({
      name: name,
      types: propertyType,
      variables: propertyTypeVariable,
    });
  }

  // TODO: Floats
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
    const propertyType = ["Thing"];
    const propertyTypeVariable = ["?thing"];

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
    const propertyType = ["Thing"];
    const propertyTypeVariable = ["?thing"];

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
  generatedObjectTypes.add("Thing");

  // an other object type is "integer" and "float"
  // only available if there is an affordance of type integer or number
  for (const property in td.properties) {
    if (td.properties[property].type == "integer") {
      generatedObjectTypes.add("integer");
    }
    if (td.properties[property].type == "number") {
      generatedObjectTypes.add("float");
    }
  }
  for (const action in td.actions) {
    if (td.actions[action].type == "integer") {
      generatedObjectTypes.add("integer");
    }
    if (td.actions[action].type == "number") {
      generatedObjectTypes.add("float");
    }
  }

  // convert set to array
  availableObjectTypes = Array.from(generatedObjectTypes);
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
    functionString += "(";

    for (let i = 0; i < functionName.types.length; i++) {
      if (
        !addedFunctions.includes(
          `${functionName.name}${functionName.variables[i]}`
        )
      ) {
        functionString += ` ${functionName.name} ${functionName.variables[i]} - ${functionName.types[i]}`;

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
    actionString += `(:action ${action.name}\n:parameters(${action.params})\n:precondition(${action.pre})\n:effect(${action.effect}))\n`;
  }
  template = template.replace("<!--actions-->", actionString);

  return template;
}

function generateDomain(td, domainName) {
  // Generate Object Types
  generateObjectTypes(td);
  console.log("Types:", availableObjectTypes);

  generatePredicates(td);
  console.log("Predicates:", availablePredicates);

  generateFunctions(td);
  console.log("Functions:", availableFunctions);

  generateActions(td);
  console.log("Actions", availableActions);

  const domain = createDomainTemplate(domainName);
  console.log(domain);
}

async function main() {
  const servient = new Servient();
  servient.addClientFactory(new HttpClientFactory(null));

  servient
    .start()

    .then(async (WoT) => {
      // Get Thing Desccription
      const td = await WoT.requestThingDescription(
        "http://172.17.187.244:3001/"
      );

      const domainName = "myDomain";
      const pddlDomain = generateDomain(td, domainName);

      let thing = await WoT.consume(td);
    })
    .catch((err) => {
      console.error(err);
    });
}

main();
