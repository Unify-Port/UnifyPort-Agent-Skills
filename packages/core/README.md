# UnifyPort Agent Core

[English](README.md) | [简体中文](README.zh-CN.md)

`@unifyport/agent-core` is the shared policy runtime for this repository. It consumes the pinned
public Device API SDK and the generated operation policy catalog.

The package enforces:

- fixed operation dispatch with no arbitrary method, path, header, or base URL;
- read, write, and destructive permission gates;
- request-bound confirmation digests;
- closed input projection and declared-field output projection;
- environment-only API authentication;
- secret references for protected input;
- pre-reserved secure sinks for one-time secret output;
- safe errors containing only stable code, status, and request ID.

This package is source-complete in the repository but is not considered published until a release
contains registry metadata and a verified package artifact.

Use the higher-level [server package](../server/README.md) for CLI, stdio MCP, or Streamable HTTP.
