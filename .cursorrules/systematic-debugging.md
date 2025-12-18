---
description: Debugging Process
globs: *.tsx, *.py
alwaysApply: true
---

# Debugging Process

When debugging issues or implementing complex functionality, follow these systematic debugging guidelines to avoid frustration and ensure effective problem-solving.

## Understand Before Changing
- Take time to fully understand the root cause before implementing any solution
- Read documentation thoroughly, especially for third-party libraries
- Inspect the DOM, component hierarchy, and data flow to identify the actual problem
- Avoid making random changes hoping something will work
- Create a clear hypothesis about what's causing the issue before attempting fixes

## Research Thoroughly
- Research third-party libraries and components before modifying their behavior
- Check GitHub issues, Stack Overflow, and official documentation for known issues
- Understand the library's event system, lifecycle, and architecture
- Look for existing solutions to common problems before creating custom ones
- Verify compatibility between different libraries and frameworks

## Implement Proper Debugging Techniques
- Use console logs strategically to trace execution flow and data changes
- Leverage browser developer tools for DOM inspection and event monitoring
- Set breakpoints to step through code execution
- Check network requests and responses for API-related issues
- Isolate components to test them independently
- Create minimal reproducible examples to verify issues

## Test Systematically
- Test solutions thoroughly in isolation before integrating them
- Verify that fixes don't break other functionality
- Test edge cases and boundary conditions
- Ensure changes work across different browsers and devices
- Validate that the solution addresses the root cause, not just symptoms

## Avoid Common Debugging Pitfalls
- Don't persist with an approach that has failed multiple times
- Avoid making changes without understanding their impact
- Don't implement overly complex solutions for simple problems
- Resist the urge to rewrite working code without clear justification
- Never make multiple significant changes at once - isolate variables

## Handle Third-Party Components Carefully
- Understand how the component's event system works before modifying it
- Be cautious when overriding default behaviors
- Check if there are built-in configuration options before custom solutions
- Consider the component's update cycle and how it might affect your changes
- Look for official examples and documentation for common integration patterns

## When Stuck, Change Approach
- If a solution isn't working after multiple attempts, step back and reassess
- Consider alternative approaches rather than minor variations of the same idea
- Ask for help or clarification when needed
- Break the problem down into smaller, more manageable parts
- Document what you've tried and why it didn't work

## Communicate Effectively About Debugging
- Be transparent about limitations in your understanding
- Explain your debugging process and findings clearly
- Acknowledge when you're uncertain about a solution
- Provide context about why certain approaches might or might not work
- Be honest about the complexity of issues and potential solutions

## Learn From Debugging Failures
- Document lessons learned from debugging challenges
- Identify patterns in issues that cause repeated problems
- Create reusable solutions for common problems
- Improve your mental model of how systems interact
- Take responsibility for mistakes and use them as learning opportunities 