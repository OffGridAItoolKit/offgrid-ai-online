# Operations & Troubleshooting Manual

**Version 1.1.0** | **Last Updated:** 2026-07-10

This manual provides standard operating procedures (SOPs) for monitoring, troubleshooting, and maintaining the OffGrid AI Field Guide online platform.

---

## 1. Render Service Logs

The platform uses the logs already provided by its Render web service. Application code does not transmit a second copy of operational events to an external log-aggregation platform.

### 1.1. Accessing the Logs

1. Log in to the Render dashboard.
2. Select the `offgrid-ai-online` web service.
3. Open **Logs** to review deployment output, application console messages, and technical request records.

### 1.2. Privacy Boundaries

- Application console messages must not contain prompts, AI responses, uploaded media, feedback details, license keys, email addresses, or raw network addresses.
- Render request logs may contain technical metadata such as request path, network address, user agent, status, duration, and response size.
- The current Starter service retains Render logs for seven days.
- In-app feedback is stored only in the application database after the user explicitly submits it.

### 1.3. Troubleshooting

Use the Render logs together with `/api/health`, the passive Image Studio health endpoint, deployment history, and user-submitted feedback. Avoid adding another log processor unless a specific operational need justifies the additional privacy and account-management overhead.

## 2. Health Checks

The platform includes built-in health check endpoints to provide a real-time snapshot of system status.

### 2.1. General Health Check

*   **Endpoint**: `/api/health`
*   **Method**: `GET`
*   **Description**: A simple endpoint that returns a `200 OK` response if the server is running. This is useful for basic uptime monitoring.

### 2.2. Image Generation Health Check

*   **Endpoint**: `/api/health/image-gen`
*   **Method**: `GET`
*   **Description**: A more comprehensive health check for the Image Studio. It performs a live test of the image generation model and returns a JSON object with detailed statistics, including:
    *   `healthy`: A boolean indicating if the live test was successful.
    *   `testDurationMs`: The duration of the live test in milliseconds.
    *   `recentStats`: Performance statistics over the last 24 hours, including success rate and average response time.
    *   `recentLog`: A log of the last 10 image generation attempts (without any user data).

## 3. Manual Health Check Script

For more advanced or automated monitoring, a standalone health check script is included in the project.

*   **Location**: `scripts/health-check.sh`
*   **Description**: A bash script that can be run from the command line to test the image generation service.

### 3.1. Usage

**Quick Check**:

```bash
./scripts/health-check.sh
```

This runs a single test with a simple prompt.

**Full Check**:

```bash
./scripts/health-check.sh --full
```

This runs three tests with different types of prompts (a simple shape, a nature scene, and an infographic).

**Logging Results**:

```bash
./scripts/health-check.sh --full --log /path/to/health-log.csv
```

This appends the test results to a CSV file, which can be used for trend analysis.

### 3.2. Cron Job for Automated Monitoring

You can set up a cron job to run the health check script at regular intervals. For example, to run a full check every 6 hours and log the results, you could add the following to your crontab:

```
0 */6 * * * /path/to/your/project/scripts/health-check.sh --full --log /path/to/your/project/health-log.csv
```

---

*This manual provides a high-level overview. For more detailed technical information, please refer to the **Technical Overview** and **Command Center Developer Documentation**.*
