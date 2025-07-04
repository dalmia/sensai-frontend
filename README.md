## SensAI frontend

SensAI is an AI-first Learning Management System (LMS) which enables educators to help them teacher smarter and reach further. SensAI coaches your students through questions that develop deeper thinking—just like you would, but for every student and all the time. This repository is the frontend for SensAI. The backend repository can be found [here](https://github.com/dalmia/sensai-backend).

[![coverage report](https://codecov.io/gh/dalmia/sensai-frontend/branch/main/graph/badge.svg)](https://codecov.io/gh/dalmia/sensai-frontend)

If you are using SensAI and have any feedback for us or want any help with using SensAI, please consider [joining our community](https://chat.whatsapp.com/LmiulDbWpcXIgqNK6fZyxe) of AI + Education builders and reaching out to us.

If you want to contribute to SensAI, please look at the `Contributing` section [here](https://github.com/dalmia/sensai-backend/blob/main/docs/CONTRIBUTING.md).

Our public roadmap is live [here](https://hyperverge.notion.site/fa1dd0cef7194fa9bf95c28820dca57f?v=ec52c6a716e94df180dcc8ced3d87610). Go check it out and let us know what you think we should build next!

## Contributing
To learn more about making a contribution to SensAI, please see our [Contributing guide](https://github.com/dalmia/sensai-backend/blob/main/docs/CONTRIBUTING.md).

## Installation
- Make sure the backend is set up properly. Refer to the backend [installation guide](https://github.com/dalmia/sensai-backend/blob/main/docs/INSTALL.md) for more information.
- Ensure you have Node.js installed on your machine.
- Clone the repository:
  ```
  git clone https://github.com/dalmia/sensai-frontend.git
  cd sensai-frontend
  ```
- Copy `.env.example` to `.env.local` and set the environment variables. We use Judge0 for code execution. You will need to add the Judge0 API key to the `.env.local` file. Either self-host it or use the publicly available Judge0 instance. Please refer to the [Judge0 installation guide](https://github.com/dalmia/sensai-backend/blob/main/docs/INSTALL.md#judge0) for more information. Set up your Google OAuth account and enter those   credentials in the `.env.local` file.
- Install dependencies:
  ```
  npm ci
  ```
- Run the development server:
  ```
  npm run dev
  ```

The app will be available at `http://localhost:3000`.

## Testing

SensAI uses Jest and React Testing Library for testing. The test suite includes unit tests and component tests to ensure code quality and prevent regressions. Codecov is used to track the coverage of the tests.

- Run all tests (and generate a coverage report):
  ```
  npm run test:ci
  ```

- (optional) Upload the coverage report to Codecov:
  ```
  curl -Os https://cli.codecov.io/v10.4.0/macos/codecov
  chmod +x codecov
  ./codecov upload-process -f coverage/lcov.info
  ```


## Community
We are building a community of creators, builders, teachers, learners, parents, entrepreneurs, non-profits and volunteers who are excited about the future of AI and education. If you identify as one and want to be part of it, consider [joining our community](https://chat.whatsapp.com/LmiulDbWpcXIgqNK6fZyxe).