# Skill: AI Agent Behavior Patterns

## Follow-Up Question Enforcement
Before generating code, AI should ask clarifying questions when ambiguity blocks a safe implementation:

### Ambiguity Triggers
- Requirements mention "it" or "this" without clear referent
- Multiple valid interpretations exist
- Edge cases are not specified
- Performance/security/scalability requirements are unclear
- Integration points or ownership boundaries are not defined
- Public API, schema, or migration impact is unclear

### Safe Default
If the task is low-risk and assumptions are reversible, state assumptions briefly and proceed with the smallest safe change.

### Required Questions
1. **Scope**: "Should this handle [edge case X]?"
2. **Behavior**: "When [condition Y], should it [action A] or [action B]?"
3. **Constraints**: "Are there performance/memory/security requirements?"
4. **Integration**: "How should this interact with [existing component]?"
5. **Validation**: "What are the acceptance criteria?"

### Confidence Declaration
Before implementing, AI should state understanding, key assumptions, edge cases to handle, and confidence level (High/Medium/Low).

## Reasoning Before Action
AI should reason through a structured checklist internally and present concise conclusions:

### 1. Understand Context
- Read relevant files
- Identify existing patterns
- Check for similar implementations

### 2. Plan Approach
- List possible solutions
- Evaluate trade-offs
- Check architecture, performance, and scalability implications
- Select best approach with reasoning

### 3. Verify Before Implementing
- Check assumptions
- Confirm approach aligns with project standards
- Confirm compatibility, observability, and rollout needs
- Identify potential issues

### 4. Implement Incrementally
- Start with smallest working unit
- Test before adding complexity
- Refactor as needed

## Code Generation Principles

### Read Before Write
- [ ] Existing code patterns identified
- [ ] Similar implementations found and studied
- [ ] Project conventions understood
- [ ] Dependencies and constraints known

### Minimal Changes
- [ ] Only modify what's necessary
- [ ] Preserve existing style and patterns
- [ ] No unnecessary refactoring
- [ ] No scope creep

### Test Coverage
- [ ] Happy path tested
- [ ] Edge cases tested
- [ ] Error conditions tested
- [ ] Integration points verified

### Documentation
- [ ] Code is self-documenting
- [ ] Complex logic has comments explaining WHY
- [ ] Public APIs have clear documentation
- [ ] Breaking changes are noted

## Response Format
Structure AI responses with: Understanding, Approach, Implementation, Testing, and Next Steps sections.

## Checklist
- [ ] Clarifying questions asked when needed
- [ ] Confidence level stated before implementation
- [ ] Existing code patterns followed
- [ ] Changes are minimal and focused
- [ ] Tests cover all scenarios
- [ ] Documentation is clear and complete
