---
description: Project information
globs: *.tsx, *.py
alwaysApply: false
---
 
# AI Teaching Assistant

## Project Overview
This project is an AI Teaching Assistant designed to help teachers scale themselves with the help of an AI teaching assistant. The platform enables educators to create courses, organize them into cohorts, and provide learners with an interactive learning experience enhanced by AI.

## Core Features

### User Roles & Organizations
- Users can be both educators and learners depending on the context
- Each user starts with a personal workspace upon signup
- Users can create organizations or be added to existing ones
- Authentication is handled via Google login only

### Course Structure
- Courses are divided into modules
- Modules contain a mix of learning materials and quizzes in any order
- Learning materials and quizzes use a block-based editor (similar to Notion)
- Students progress at their own pace (no deadlines)
- Courses can be added to multiple cohorts

### Course Display & Navigation
- Home page adapts based on available courses:
  - Shows only "Your Courses" when user only has teaching courses
  - Shows only "Enrolled Courses" when user only has learning courses
  - Shows tab navigation when user has both teaching and learning courses
  - Shows a welcoming placeholder with course creation/browsing options when no courses exist
- Automatic tab selection based on available course types
- Clear visual distinction between courses created by the user and courses they're enrolled in

### Cohort Management
- Cohorts are created by invitation
- A cohort can have multiple courses
- No built-in communication features between cohort members

### AI Teaching Assistant Capabilities
- Provides feedback on student quiz responses
- Generates quizzes/questions/learning materials from text or voice prompts
- Can generate entire courses from documents or videos
- Analyzes learner conversations to generate insights for teachers
- Identifies student struggles and suggests improvements for teaching materials

### Analytics
- Organization-level analytics
- Cohort-level analytics (across cohorts or for a single course)
- Course-level analytics (across cohorts or a single cohort)

## Technical Stack
- Frontend: Next.js
- Styling: Tailwind CSS with shadcn components
- Database: SQLite (initial implementation)
- UI Design: Playful yet professional, game-like experience
- AI Integration: Mocked initially, to be implemented later

## Deployment
- Current: EC2 with Docker container
- Considering alternatives for cost-efficiency, control, and faster shipping

## Development Priorities
- Focus on building a clean, simple, and intuitive UI
- Implement core functionality page by page
- Mock AI features initially
- Adaptive UI that responds to user context and available content