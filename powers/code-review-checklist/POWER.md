---
name: "code-review-checklist"
displayName: "Code Review Checklist"
description: "A comprehensive checklist for conducting effective code reviews with best practices and common pitfalls to avoid."
keywords: ["code-review", "checklist", "pull-request", "pr-review"]
author: "Your Name"
---

# Code Review Checklist

## Overview

This power provides a structured checklist for conducting thorough code reviews. It helps reviewers catch common issues, maintain code quality, and provide constructive feedback.

## Onboarding

No installation required - this is a knowledge base power. Simply activate it when you need guidance during code reviews.

## Quick Checklist

### Code Quality
- [ ] Code is readable and well-organized
- [ ] Functions are small and focused (single responsibility)
- [ ] Variable and function names are descriptive
- [ ] No unnecessary comments (code should be self-documenting)
- [ ] No dead code or commented-out blocks

### Logic & Correctness
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] No obvious bugs or logic errors
- [ ] Input validation is present where needed

### Security
- [ ] No hardcoded secrets or credentials
- [ ] User input is sanitized
- [ ] SQL queries use parameterized statements
- [ ] Authentication/authorization checks are in place

### Performance
- [ ] No unnecessary loops or database calls
- [ ] Large data sets are paginated
- [ ] Expensive operations are cached where appropriate

### Testing
- [ ] New code has appropriate test coverage
- [ ] Tests are meaningful (not just for coverage)
- [ ] Edge cases are tested

## Best Practices for Reviewers

1. **Be constructive** - Suggest improvements, don't just criticize
2. **Ask questions** - "What happens if X?" is better than "This is wrong"
3. **Praise good code** - Acknowledge well-written solutions
4. **Focus on the code, not the person** - Keep feedback objective
5. **Be timely** - Review promptly to keep the team moving

## Common Pitfalls to Avoid

- Nitpicking style issues (use linters instead)
- Rubber-stamping without actually reading
- Being overly harsh or dismissive
- Ignoring the bigger picture for minor details
