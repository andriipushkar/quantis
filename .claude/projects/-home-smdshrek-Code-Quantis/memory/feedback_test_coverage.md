---
name: Test coverage requirement
description: Project must maintain >80% test coverage — always write tests for new code
type: feedback
---

Project must be covered by more than 80% tests. Always write comprehensive tests for any new code.

**Why:** User explicitly requires high test coverage for production-readiness. Quantis handles financial data where bugs = money loss.

**How to apply:** When writing any new feature or refactoring code, always create corresponding test files. Prioritize testing business logic (signals, indicators, trading, payments, auth flows). Run full test suite before committing.
