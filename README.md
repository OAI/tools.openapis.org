# OpenAPI Tooling

This project is provided by the OpenAPI Initiative as a means to centralize ecosystem information on OpenAPI-related tooling. It leverages open source projects that have gone before to provide a consolidated list of tooling.

The project Kanban board for Tooling can be found here: https://github.com/OAI/Projects/projects/4

## Roll Call

The following projects are being leveraged to provide the majority of the source information.

| Name | Source | Description |
| ---- | ------ | ----------- |
| OpenAPI Specification | https://github.com/OAI/OpenAPI-Specification | IMPLEMENTATIONS.md file containing tooling list. |
| OpenAPI.Tools | https://github.com/apisyouwonthate/openapi.tools | APIs Your Won't Hate efforts to create uber list of tooling. |
| APIs.guru | https://github.com/apis-guru/awesome-openapi3 | Repository/site based on tagged repositories in Github.<br>This repository reuses the build approach rather than pulling the list from the source. |

## How Can You Help?

This project is designed to continue the work of APIs.guru and collect data based on tagged repositories.

If you want your project included in the tooling list tag your project with one-or-more of the following:

* `swagger|openapi2` (For Swagger/OpenAPI 2.0 support).
* `openapi3` (For OpenAPI 3.0 support).
* `openapi31` (For OpenAPI 3.1 support).

Note right now only `openapi3` is being collected. Processors for other tags are being built at the time of writing.

## Design

The design approach is split into two features:

* A unified list of tooling merged from sources across the interwebs that users can grab and slice-and-dice as they see fit.
* A website that allows users to search and inspect the tooling data first hand.

Each is expanded upon in the sections below.

### Unified Tooling List

The tooling list is built in largely the same format as the majority of projects that have blazed a trail in tooling before (which of course this project takes full advantage of).

In order to bring this together in a sensible way a Gulp-based process has been implemented. Gulp was chosen given the relative ease with which functions can be implemented to massage the data stream and to ensure the build is not closely-coupled to a (commercial) CI tool. There's a couple of principles around the design worth stating:

* The transform functions that massage the data are abstracted away from Gulp to enable the build to "lift-and-shift" to a new build tool as required.
* Pipes between functions are always formatted as YAML to allow for simple dumping of the data for humans appraisal.
* The source data collection is written as independent packages referenced by metadata to allow new sources to be "slotted" in.

Note that if better tools are identified for the build then Gulp should be easy to change.

### Full Build

The full build takes the following approach:

* Retrieve each tooling source, including the existing list at [docs/tools.yaml](docs/tools.yaml).
* Combine source data based on repository name.
* Normalise property names across sources using simple statistics (Sørensen–Dice, Damerau–Levenshtein distance).
* Get repository metadata from GitHub.
* Write to [docs/tools.yaml](docs/tools.yaml).

Currently this build is scheduled using [GitHub Actions](.github/workflows/full.yaml) and runs once a week on Sunday.

The schedule will be reviewed as we collect data to see if executing it with greater frequency would be beneficial.

> If you plan to run the build interactively access to the GitHub API is required. This is supported through [basic authentication](https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api#authentication) using a GitHub username (set by default in GitHub Actions as GITHUB_ACTOR, which is fine for orchestrating the workflow) and a [personal access token](https://github.com/settings/tokens/new) as environment variables.

To run the full build at the command line:

```bash
yarn install
GITHUB_ACTOR=<username> GITHUB_TOKEN=<personal-access-token> && yarn run build:full
```

### Metadata Update

The goal of the metadata update is to provide consistent repository metadata without sourcing new tooling:

* Read the existing list at [docs/tools.yaml](docs/tools.yaml).
* Get repository metadata from GitHub.
* Write to [docs/tools.yaml](docs/tools.yaml).

Currently this build is scheduled using [GitHub Actions](.github/workflows/metadata.yaml) and runs every day.

The scheduled will be reviewed as we collect data to see if executing it with greater frequency would be beneficial.

To run the metadata build at the command line:

```bash
yarn install # If you haven't done this already
GITHUB_ACTOR=<username> GITHUB_TOKEN=<personal-access-token> && yarn run build:metadata
```

### Website

This is a work-in-progress and as yet undocumented.
