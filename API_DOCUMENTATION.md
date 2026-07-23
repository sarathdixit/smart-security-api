# Smart Security System — Complete API Documentation & Usage Guide

Complete production documentation for the **Smart Security System** backend API services (Next.js & Firebase Admin SDK).

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Base URL & Authentication](#base-url--authentication)
3. [Endpoints Specification](#endpoints-specification)
   - [1. Fetch Alarm & Event Logs (`GET /api/alarm/logs`)](#1-fetch-alarm--event-logs-get-apialarmlogs)
   - [2. Acknowledge Alarm (`POST /api/alarm/acknowledge`)](#2-acknowledge-alarm-post-apialarmacknowledge)
   - [3. Get System Arm Status (`GET /api/alarm/arm`)](#3-get-system-arm-status-get-apialarmarm)
   - [4. Set / Toggle System Arm Status (`POST /api/alarm/arm`)](#4-set--toggle-system-arm-status-post-apialarmarm)
   - [5. ESP32 Sensor Event Ingestion (`POST /api/events`)](#5-esp32-sensor-event-ingestion-post-apievents)
   - [6. ESP32 Telemetry & Heartbeat (`POST /api/heartbeat`)](#6-esp32-telemetry--heartbeat-post-apiheartbeat)
   - [7. Device Offline Check Cron (`GET /api/cron/check-offline`)](#7-device-offline-check-cron-get-apicroncheck-offline)
4. [FCM Broadcast Payload & Full-Screen Notification Behavior](#fcm-broadcast-payload--full-screen-notification-behavior)

---

## Overview & Architecture

The Smart Security System backend manages real-time hardware pings, sensor triggers (`GATE_TOUCH`), security arming/disarming status, audit logs, and emergency FCM push notifications across user mobile applications.

* **Database**: Firebase Firestore (`devices/{deviceId}` and subcollections `devices/{deviceId}/logs`).
* **Push Notifications**: Firebase Cloud Messaging (FCM) Admin SDK (`messaging.send()`).

---

## Base URL & Authentication

* **Production / Local Base URL**: `http://localhost:3000` (or your deployed server domain).
* **Hardware API Authentication**:
  - `POST /api/events` and `POST /api/heartbeat` accept an optional `Authorization: Bearer <API_SECRET_KEY>` header for hardware verification.
* **Cron API Authentication**:
  - `GET /api/cron/check-offline` requires `Authorization: Bearer <CRON_SECRET>`.

---

## Endpoints Specification

### 1. Fetch Alarm & Event Logs (`GET /api/alarm/logs`)

Retrieves historical alarm logs, sensor triggers (`GATE_TOUCH`), system status changes (`SYSTEM_ARMED`, `SYSTEM_DISARMED`), and offline pings (`DEVICE_OFFLINE`), ordered by timestamp descending.

* **HTTP Method**: `GET`
* **Path**: `/api/alarm/logs`
* **Query Parameters**:
  - `limit` *(optional, integer, default: `100`)*: Maximum logs to retrieve.
  - `deviceId` *(optional, string)*: Filter logs for a specific device (e.g. `TEMPLE001`).

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "count": 3,
  "logs": [
    {
      "logId": "9xK12aLpQm0aZb3Y4k8C",
      "deviceId": "TEMPLE001",
      "alarmType": "SYSTEM_DISARMED",
      "message": "Security system disarmed by Sarath Kumar",
      "acknowledged": true,
      "acknowledgedByUid": "google_auth_uid_12345",
      "acknowledgedByName": "Sarath Kumar",
      "acknowledgedAt": "2026-07-23T17:33:28.000Z",
      "timestamp": "2026-07-23T17:33:28.000Z"
    },
    {
      "logId": "8fK92xLpQm0aZb3Y1x7A",
      "deviceId": "TEMPLE001",
      "alarmType": "GATE_TOUCH",
      "message": "Movement detected on Main Gate",
      "acknowledged": false,
      "acknowledgedByUid": null,
      "acknowledgedByName": null,
      "acknowledgedAt": null,
      "timestamp": "2026-07-23T14:15:30.000Z"
    },
    {
      "logId": "1aB23xLpQm0aZb3Y5x9Z",
      "deviceId": "TEMPLE001",
      "alarmType": "DEVICE_OFFLINE",
      "message": "No heartbeat received for over 90 seconds.",
      "acknowledged": false,
      "acknowledgedByUid": null,
      "acknowledgedByName": null,
      "acknowledgedAt": null,
      "timestamp": "2026-07-23T07:10:00.000Z"
    }
  ]
}
```

#### Example Usage
```bash
curl -X GET "http://localhost:3000/api/alarm/logs?limit=50&deviceId=TEMPLE001"
```

---

### 2. Acknowledge Alarm (`POST /api/alarm/acknowledge`)

Marks an active alarm log as acknowledged in Firestore by an authorized user after entering their security PIN on the mobile app.

* **HTTP Method**: `POST`
* **Path**: `/api/alarm/acknowledge`
* **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "deviceId": "TEMPLE001",
  "logId": "8fK92xLpQm0aZb3Y1x7A",
  "userUid": "google_auth_uid_12345",
  "userName": "Sarath Kumar",
  "userEmail": "sarath@example.com"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Alarm acknowledged successfully."
}
```

#### Error Responses
- `400 Bad Request`: Missing mandatory `deviceId` or `logId`.
- `404 Not Found`: Log ID not found in Firestore for `deviceId`.
- `500 Server Error`: Database failure.

#### Example Usage
```bash
curl -X POST "http://localhost:3000/api/alarm/acknowledge" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEMPLE001",
    "logId": "8fK92xLpQm0aZb3Y1x7A",
    "userUid": "google_auth_uid_12345",
    "userName": "Sarath Kumar"
  }'
```

---

### 3. Get System Arm Status (`GET /api/alarm/arm`)

Retrieves whether the security system is currently **Armed** (`isArmed: true`) or **Disarmed** (`isArmed: false`).

* **HTTP Method**: `GET`
* **Path**: `/api/alarm/arm` (Alias: `/api/device/arm`)
* **Query Parameters**:
  - `deviceId` *(optional, string, default: `"TEMPLE001"`)*

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "deviceId": "TEMPLE001",
  "isArmed": true
}
```

#### Example Usage
```bash
curl -X GET "http://localhost:3000/api/alarm/arm?deviceId=TEMPLE001"
```

---

### 4. Set / Toggle System Arm Status (`POST /api/alarm/arm`)

Arms or Disarms the security system using the toggle button on the app or web interface. Records an audit log entry in `devices/{deviceId}/logs` so it appears in `GET /api/alarm/logs`.

* **HTTP Method**: `POST`
* **Path**: `/api/alarm/arm` (Alias: `/api/device/arm`)
* **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "deviceId": "TEMPLE001",
  "isArmed": false,
  "userUid": "google_auth_uid_12345",
  "userName": "Sarath Kumar",
  "userEmail": "sarath@example.com"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Security system disarmed by Sarath Kumar",
  "deviceId": "TEMPLE001",
  "isArmed": false,
  "logId": "9xK12aLpQm0aZb3Y4k8C",
  "userUid": "google_auth_uid_12345",
  "userName": "Sarath Kumar"
}
```

#### Example Usage
```bash
curl -X POST "http://localhost:3000/api/alarm/arm" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEMPLE001",
    "isArmed": true,
    "userUid": "google_auth_uid_12345",
    "userName": "Sarath Kumar"
  }'
```

---

### 5. ESP32 Sensor Event Ingestion (`POST /api/events`)

Called by the ESP32 microcontroller when a touch sensor event (`GATE_TOUCH`) is detected.

* **HTTP Method**: `POST`
* **Path**: `/api/events`
* **Headers**:
  - `Authorization: Bearer <API_SECRET_KEY>` *(if configured)*
  - `Content-Type: application/json`

#### Request Body
```json
{
  "deviceId": "TEMPLE001",
  "event": "GATE_TOUCH",
  "message": "Movement detected on Main Gate"
}
```

#### Behavior & Response:
* **System Armed (`isArmed = true`)**:
  - Writes audit log to `devices/{deviceId}/logs`.
  - Dispatches full-screen high-priority FCM emergency push notification to topics `device_TEMPLE001` and `temple_owners`.
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "logId": "8fK92xLpQm0aZb3Y1x7A",
      "isArmed": true,
      "notificationSent": true,
      "message": "GATE_TOUCH alarm triggered and FCM broadcast dispatched."
    }
    ```

* **System Disarmed (`isArmed = false`)**:
  - Writes audit log to `devices/{deviceId}/logs`.
  - Does **NOT** trigger an alarm and does **NOT** dispatch FCM notifications.
  - **Response (`200 OK`)**:
    ```json
    {
      "success": true,
      "logId": "8fK92xLpQm0aZb3Y1x7A",
      "isArmed": false,
      "notificationSent": false,
      "message": "System is disarmed. Event logged without triggering alarm."
    }
    ```

#### Error Response
* `400 Bad Request`: Payload missing `deviceId` or `event` is not `"GATE_TOUCH"`.

---

### 6. ESP32 Telemetry & Heartbeat (`POST /api/heartbeat`)

Periodic keep-alive signal sent by the ESP32 microcontroller to report connection health, WiFi RSSI signal strength, and device uptime.

* **HTTP Method**: `POST`
* **Path**: `/api/heartbeat`
* **Headers**: `Authorization: Bearer <API_SECRET_KEY>` *(if configured)*

#### Request Body
```json
{
  "deviceId": "TEMPLE001",
  "wifiSignal": -65,
  "uptime": 86400
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "message": "Heartbeat recorded"
}
```

---

### 7. Device Offline Check Cron (`GET /api/cron/check-offline`)

Automated cron endpoint called by Cloud Scheduler or Vercel Cron to flag devices offline if no heartbeat has been received for >90 seconds.

* **HTTP Method**: `GET`
* **Path**: `/api/cron/check-offline`
* **Headers**: `Authorization: Bearer <CRON_SECRET>`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "checkedAt": "2026-07-23T17:36:00.000Z"
}
```

---

## FCM Broadcast Payload & Data-Only Notification Behavior

When `POST /api/events` ingests a `GATE_TOUCH` event while the system is **Armed**, the server dispatches a **Data-Only FCM Payload** to `device_{deviceId}` and `temple_owners`:

```json
{
  "android": {
    "priority": "high",
    "ttl": 0
  },
  "data": {
    "type": "GATE_TOUCH",
    "deviceId": "TEMPLE001",
    "logId": "8fK92xLpQm0aZb3Y1x7A",
    "title": "🚨 Temple Gate Touched!",
    "message": "Movement detected on Main Gate",
    "fullScreen": "true",
    "timestamp": "1784808960"
  }
}
```

> **Why Data-Only Payloads are used**:
> Omitting the `notification` key prevents the Android OS from automatically generating duplicate system notifications when the app is in the background or killed. This gives the mobile client (Notifee / Native Modules) 100% control over sound, vibration, tray notifications, and full-screen alarm overlays with zero OS interference.

