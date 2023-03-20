# OpenAPI Tooling

This project is provided by the OpenAPI Initiative as a means to centralize ecosystem information on OpenAPI-related tooling. It leverages open source projects that have gone before to provide a consolidated list of tooling.

The project is split into two features:

- A list of tooling merged from sources across the interwebs that users can grab and slice-and-dice as they see fit.
- A website that allows users to search and inspect the tooling data first hand.

Each is expanded upon in the sections below.

The project Kanban board for Tooling can be found here: https://github.com/OAI/Projects/projects/4

## Roll Call

The following projects are being leveraged to provide the majority of the source information.

| Name                  | Source                                           | Description                                                                                                                                        |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAPI Specification | https://github.com/OAI/OpenAPI-Specification     | IMPLEMENTATIONS.md file containing tooling list.                                                                                                   |
| OpenAPI.Tools         | https://github.com/apisyouwonthate/openapi.tools | APIs Your Won't Hate efforts to create uber list of tooling.                                                                                       |
| APIs.guru             | https://github.com/apis-guru/awesome-openapi3    | Repository/site based on tagged repositories in Github.<br>This repository reuses the build approach rather than pulling the list from the source. |

## How Can You Help?

This project is designed to continue the work of APIs.guru and collect data based on repositories tagged with a topic.

If you want your project included in the tooling list tag your project with one-or-more of the following topics:

- `swagger` or `openapi2` (For Swagger/OpenAPI 2.0 support).
- `openapi3` (For OpenAPI 3.0 support).
- `openapi31` (For OpenAPI 3.1 support).

If you aren't familiar with topics in GitHub please follow [this guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics) to add them to your repository.

> **_Note: Collection of the `swagger`/`openapi2` topics is not currently implemented - see dependencies described in this [issue](https://github.com/OAI/Tooling/issues/19)._**

## Tooling List

The tooling list is built in largely the same format as the majority of projects that have blazed a trail in tooling before (which of course this project takes full advantage of).

In order to bring this together in a sensible way a Gulp-based process has been implemented. Gulp was chosen given the relative ease with which functions can be implemented to massage the data stream and to ensure the build is not closely-coupled to a (commercial) CI tool. There's a couple of principles around the design worth stating:

- The transform functions that massage the data are abstracted away from Gulp to enable the build to "lift-and-shift" to a new build tool as required.
- Pipes between functions are always formatted as YAML to allow for simple dumping of the data for humans appraisal.
- The source data collection is written as independent packages referenced by metadata to allow new sources to be "slotted" in.

Note that if better tools are identified for the build then Gulp should be easy to change.

### Environment Variables

Access to the GitHub API is required to run the build. Access is supported through [basic authentication](https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api#authentication) using a GitHub username and a [personal access token](https://github.com/settings/tokens/new) as environment variables.

The following variables are therefore required to run the build:

| Name                     | Description                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GH_API_USERNAME          | GitHub username to access the GitHub API                                                                                                                                              |
| GH_API_TOKEN             | OAuth/Personal Access Token to access the GitHub API                                                                                                                                  |
| GH_API_CONCURRENCY_TOKEN | Number of simultaneous connections to the GitHub API. Recommended value is 2.<br>Values greater than 2 appear to result in connections being throttled and the API returning a `403`. |

> **You must export these before running either of the data collection builds.**

We've used custom environment variables for GitHub API access rather than default GitHub variables provided by Actions. This provides both a separation-of-concerns between access controls and the build mechanism and enables higher rate limits.

> Note: We plan to introduce `dotenv` to help with the setting of environment variables.

### Full Build

The full build takes the following approach:

- Retrieve each tooling source, including the existing list at [`src/_data/tools.yaml`](src/_data/tools.yaml).
- Combine source data based on repository name.
- Normalise property names across sources using simple statistics (Sørensen–Dice, Damerau–Levenshtein distance).
- Get repository metadata from GitHub.
- Categorise the tools using Bayesian statistics.
- Write to [`src/_data/tools.yaml`](src/_data/tools.yaml).

Currently this build is scheduled using [GitHub Actions](.github/workflows/full.yaml) and runs once a week on Sunday.

The schedule will be reviewed as we collect data to see if executing it with greater frequency would be beneficial.

To run the full build locally:

```bash
yarn install

GH_API_USERNAME=<username> GH_API_TOKEN=<personal-access-token> GH_AP_CONCURRENCY_LIMIT=2
export GH_API_USERNAME GH_API_TOKEN GH_AP_CONCURRENCY_LIMIT
yarn run build:data:full
```

### Metadata Update

The goal of the metadata update is to provide consistent repository metadata without sourcing new tooling:

- Read the existing list at [`src/_data/tools.yaml`](src/_data/tools.yaml).
- Get repository metadata from GitHub.
- Write to [`src/_data/tools.yaml`](src/_data/tools.yaml).

Currently this build is scheduled using [GitHub Actions](.github/workflows/metadata.yaml) and runs every day.

The scheduled will be reviewed as we collect data to see if executing it with greater frequency would be beneficial.

To run the metadata build locally:

```bash
# If you haven't done this already
yarn install

# If you haven't done this already
GH_API_USERNAME=<username> GH_API_TOKEN=<personal-access-token> GH_AP_CONCURRENCY_LIMIT=2

# If you haven't done this already
export GH_API_USERNAME GH_API_TOKEN GH_AP_CONCURRENCY_LIMIT

yarn run build:metadata
```

## Website

The website is a static site built from the tooling data. It is exposed by GitHub Pages and can be found [here](https://oai.github.io/Tooling).

The design of the site is intentionally "lean", and provides the tooling list by category (the categorisation being done as described [above](#full-build)).

### Build

The site uses the [eleventy](https://www.11ty.dev/) site generator and is rebuilt after each [full](#full-build) and [metadata](#metadata-update) build, using the newly-updated data at [`src/_data/tools.yaml`](src/_data/tools.yaml).

To run the site build locally:

```bash
yarn install
yarn run build:site
```

> Note the build uses an environment variable `HOSTED_AT` to allow the site to be deployed to an alternative root URI and therefore amend the "Home" button. This is for the benefit of GitHub Pages, where the site is deployed to `/Tooling`. Unless you need to move URL then just leave this unset.

### Running locally

If you want to run the site locally it's just damn simple:

```bash
yarn install
yarn run serve
```

The development server is set to reload on change. Now isn't that convenient.

## Contributing

Please refer to the [Contributing Guide](CONTRIBUTING.md)
