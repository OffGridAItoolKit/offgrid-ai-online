# Operations & Troubleshooting Manual

**Version 1.0.0** | **Last Updated:** 2026-02-20

This manual provides standard operating procedures (SOPs) for monitoring, troubleshooting, and maintaining the OffGrid AI ToolKit Online platform.

---

## 1. Centralized Logging with Better Stack

To provide robust, privacy-safe operational monitoring, the platform integrates with Better Stack for centralized logging. This system allows us to track application health and performance without ever logging user prompts, conversation content, or IP addresses.

### 1.1. Accessing the Logs

All operational logs are sent to a dedicated source on Better Stack. To view the logs:

1.  Log in to your Better Stack account.
2.  Navigate to the **Logs** section.
3.  Select the source corresponding to the OffGrid AI Online platform (the source token is configured via the `BETTERSTACK_SOURCE_TOKEN` environment variable).

### 1.2. What is Logged

The logging system is designed to be **privacy-first**. It only captures metadata about application events. The following table details the events that are logged:

| Event Name | Trigger | Logged Data |
|---|---|---|
| `server.startup` | Server starts | Port, Node.js version, API key status, Better Stack status |
| `chat.free` | `/api/chat` (free) | Model used, response duration, success/error status |
| `chat.command` | `/api/command/stream` | Model used, response duration, success/error status |
| `stream.free` | `/api/stream` (free) | Model used, response duration |
| `council.complete` | AI Council finishes | Duration, Chairman model, which models responded/timed out |
| `council.error` | AI Council fails | Error type, duration |
| `image.generate` | `/api/command/generate-image` | Success/fail status, duration, finish reason, error reason |
| `prompt.craft` | `/api/command/craft-prompt` | Category, success/error status |
| `prompt.visual` | `/api/command/visual-prompt` | Category, success/error status |
| `image.summary` | `/api/command/image-summary` | Success/error status |
| `export.pdf` | `/api/export-pdf` | Error details if the export fails |

### 1.3. Troubleshooting with Logs

When troubleshooting issues, you can use the Better Stack dashboard to filter logs by event name, time range, or status (e.g., `level:error`). This can help you identify patterns, such as a specific model failing frequently or an increase in error rates after a deployment.

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
