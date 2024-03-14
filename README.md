# Thing Description to PDDL Mapper (TD2P)

This software provides a tool for mapping Thing Descriptions (TDs) to PDDL (Planning Domain Definition Language) domain and problem definitions. It is designed for compatibility with standard PDDL 2.1 compliant problem solvers. By using the [spa ontology](https://paul.ti.rw.fau.de/~jo00defe/voc/spa) for annotating TDs with preconditions and effects, users can seamlessly convert their device descriptions into a format that is readily usable with a variety of planning and problem-solving frameworks.

## Features

- **Convert Thing Descriptions to PDDL**: Maps TDs to PDDL domain and problem definitions for use in planning algorithms.
- **Link Following**: Follows links inside TDs to discover related TDs and create a combined planning problem.
- **Compatibility with Standard PDDL Solvers**: Designed to work with PDDL 2.1 compliant solvers, broadening the range of applicable planning tools.

## Installation

1. Ensure you have Node.js installed on your system. This software has been tested with Node 20.10.0 on Ubuntu 22.04 LTS.
2. Clone the repository.
3. Install the packages using npm:

    ```bash
    npm install
    ```

## Usage

To start the mapping process, adjust the IP of the initial Thing Description and run the mapper script with Node.js:

```bash
node mapper.js
```

## Example Scenario
The scenario involves two devices: a power supply capable of providing between -10 and 10 V, and a door that can open and close. To open the door, the power supply must be set to 5V, and the door must be initialized. Our mapper simplifies the planning process by requiring only the final goal (the door being open) to be specified. The planner then determines all necessary steps to achieve this goal. The example scenario is provided as the example.

## Example
The included example demonstrates how to map TDs for a power supply and a door device to PDDL definitions. Follow these steps to test it yourself:

1. Make sure the devices.js and mapper.js use correct IP adresses. The default is localhost. 
1. Start the simulated devices:
```bash
node devices.js
```
2. Run the mapper to generate the PDDL domain and problem definitions:
```bash
node mapper.js
```
3. Use the generated PDDL files with a PDDL solver of your choice. The example has been tested with the [ENHSP-19](https://sites.google.com/view/enhsp/) planner. If all files related to the ENHSP-19 planner are in ```./nbdist/``` and the ```enhsp-19.jar``` can be located, the output is parsed and translated into a WoT program.

## Contributing
Contributions to improve the Thing Description to PDDL Mapper are welcome. Please feel free to submit pull requests or open issues to discuss potential improvements or report bugs.
