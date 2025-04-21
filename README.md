# Sphere Onramp Service

## Overview

Sphere Onramp is a backend service designed to facilitate fiat-to-crypto on-ramping. It integrates with Paystack to accept fiat payments from users in Nigeria (NGN), Ghana (GHS), and Kenya (KES) via various methods (Card, Mobile Money, Bank Transfer). Upon successful payment verification through Paystack webhooks, the service can be extended to trigger the delivery of cryptocurrency to a user-specified wallet address.

The service provides API endpoints for initiating payments and checking transaction statuses. It relies on a PostgreSQL database managed by Prisma ORM to store transaction details.

## Features

*   **Multi-Currency/Country Support:** Handles payments in NGN, KES, GHS with country-specific configurations.
*   **Multiple Payment Methods:** Supports Paystack's Card, Mobile Money (M-Pesa, MTN, Airtel, etc.), and Bank Transfer channels.
*   **Database Persistence:** Stores transaction details, status, and Paystack references using Prisma and PostgreSQL.
*   **Webhook Verification:** Securely handles Paystack webhooks (`charge.success`) to reliably update transaction status.
*   **Crypto Intent:** Captures user's desired crypto asset and wallet address during payment initiation.
*   **Crypto Delivery (Placeholder):** Includes a placeholder service (`crypto.service.ts`) to integrate actual crypto sending logic.
*   **Status Check Endpoint:** Allows clients (e.g., frontend) to query the status of a transaction using its reference.
*   **Callback URL Redirection:** Redirects the user's browser back to a specified frontend URL after a payment attempt on Paystack.

## Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later recommended)
*   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
*   [PostgreSQL](https://www.postgresql.org/) server running
*   A Paystack Account (Test or Live)
*   [Postman](https://www.postman.com/) (Optional, for API testing)

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd sphere-oframp
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up PostgreSQL:**
    *   Ensure your PostgreSQL server is running.
    *   Create a database user and password.
    *   Create a database (e.g., `paystack_crypto`).

4.  **Configure Environment Variables:**
    *   Copy the `.env.example` file (if one exists) or create a `.env` file in the root directory.
    *   Update the `.env` file with your credentials:

    ```dotenv
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    # Replace with your actual PostgreSQL connection details
    DATABASE_URL="postgresql://YOUR_POSTGRES_USER:YOUR_POSTGRES_PASSWORD@localhost:5432/paystack_crypto?schema=public"

    # Replace with your Paystack API keys (Test or Live)
    PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

    # The port the server will run on
    PORT=3000

    # The default URL to redirect users to after payment attempt (Your Frontend URL)
    DEFAULT_CALLBACK_URL=http://localhost:3001/payment-callback
    ```

5.  **Apply Database Migrations:**
    *   This command creates the necessary tables (e.g., `Transaction`) in your database based on the Prisma schema.
    ```bash
    npx prisma migrate dev --name init
    ```

6.  **Generate Prisma Client:** (Often done automatically by `migrate dev`, but can be run manually)
    ```bash
    npx prisma generate
    ```

## Running the Application

*   **Development Mode (with hot-reloading):**
    ```bash
    npm run dev
    ```
*   **Production Mode:**
    ```bash
    npm run build # Compiles TypeScript to JavaScript (usually to a 'dist' folder)
    npm run start # Starts the compiled application
    ```
    The server will start on the port specified in your `.env` file (default is 3000).

## API Documentation

### 1. Initiate Payment

*   **Endpoint:** `POST /api/v1/payments/payments`
*   **Description:** Initiates a payment transaction with Paystack.
*   **Request Body:** `application/json`

    ```json
    {
        "email": "customer@example.com",
        "amount": 5000,
        "currency": "KES", // Supported: "NGN", "GHS", "KES"
        "paymentMethod": "mobile_money", // Supported: 'card', 'mobile_money', 'bank_transfer' (check COUNTRY_CONFIGS in payment.service.ts for availability per currency)
        "mobileProvider": "mpesa", // Required if paymentMethod is 'mobile_money'. Examples: KES ('mpesa', 'airtel'), GHS ('mtn', 'vodafone', 'airteltigo')
        "cryptoAsset": "USDC", // Optional: Symbol of the crypto asset (e.g., "BTC", "ETH")
        "cryptoWalletAddress": "0x1234...", // Optional: Destination wallet address
        "callbackUrl": "http://your-frontend.com/payment-result" // Optional: Overrides DEFAULT_CALLBACK_URL for this specific request
    }
    ```

*   **Success Response (200 OK):**

    ```json
    {
        "success": true,
        "data": {
            "paymentUrl": "https://checkout.paystack.com/...", // URL to redirect the user to for payment
            "reference": "T1234567890..." // Unique Paystack transaction reference
        }
    }
    ```

*   **Error Response (400 Bad Request / 500 Internal Server Error):**

    ```json
    {
        "success": false,
        "error": "Descriptive error message (e.g., Payment method not available for KES, Mobile provider required, Invalid webhook signature, etc.)"
    }
    ```

### 2. Get Transaction Status

*   **Endpoint:** `GET /api/v1/payments/transactions/:reference/status`
*   **Description:** Checks the status of a transaction using the Paystack reference. It checks the local database first and verifies with Paystack if the status is pending or the transaction isn't found locally. It may update the local status based on Paystack verification.
*   **URL Parameters:**
    *   `:reference` (string, required): The Paystack transaction reference obtained from the initiate payment response or the callback URL.
*   **Success Response (200 OK):**

    ```json
    {
        "success": true,
        "status": "success", // Current status: 'pending', 'success', 'failed', 'abandoned', etc.
        "message": "Transaction status from DB: success", // Informative message about how status was determined
        "dbData": { ... }, // Full transaction object from the database (optional)
        "paystackVerificationData": { ... } // Raw data from Paystack verification API call (optional)
    }
    ```

*   **Error Response (400 Bad Request / 404 Not Found / 500 Internal Server Error):**

    ```json
    {
        "success": false,
        "error": "Descriptive error message (e.g., Transaction reference is required, Transaction not found locally and Paystack verification failed., Transaction status could not be determined.)",
        "details": "Optional further details" // e.g., from underlying error
    }
    ```

## Webhooks

*   **Endpoint:** `POST /api/v1/webhooks/paystack`
*   **Purpose:** Paystack sends asynchronous, server-to-server notifications (events) to this endpoint to inform the backend about changes in transaction status (e.g., `charge.success`). This is the **reliable** way to confirm payment success/failure.
*   **Security:** The endpoint verifies the incoming request's signature (`x-paystack-signature` header) using your `PAYSTACK_SECRET_KEY` to ensure the request genuinely came from Paystack.
*   **Functionality:** When a `charge.success` event is received and verified for a pending transaction:
    1.  Updates the transaction status in the database to `success`.
    2.  If a `cryptoIntent` exists for the transaction, it calls the (placeholder) `sendCrypto` function.
*   **Configuration:** You must configure this endpoint URL (`http://<your-server-address>/api/v1/webhooks/paystack`) in your Paystack Dashboard under Settings -> API Keys & Webhooks.
*   **Important:** Webhooks **do not** handle user redirection. They are purely server-to-server communication.

## Callback URL and User Redirection

*   **Purpose:** To redirect the user's browser back to your frontend application after they attempt a payment on the Paystack page.
*   **Mechanism:**
    1.  You provide a `callback_url` (either per request or via the `DEFAULT_CALLBACK_URL` environment variable) when calling Paystack's `transaction.initialize` endpoint.
    2.  After the payment attempt, Paystack redirects the user's browser to this URL.
    3.  Paystack automatically appends the transaction `reference` as a query parameter. Example: `http://your-frontend.com/payment-result?reference=T1234567890...`
*   **Frontend Responsibility:** The page at your `callback_url` should:
    1.  Extract the `reference` from the URL query parameters.
    2.  Call the backend's `GET /api/v1/payments/transactions/:reference/status` endpoint to get the verified status.
    3.  Display an appropriate success or failure message to the user based on the response from the backend status endpoint.

## Going Live (Paystack Kenya - Registered Business)

To activate your Paystack account for live transactions in Kenya as a **registered business** (not a sole proprietorship/individual), you generally need to provide the following documents and information through your Paystack Dashboard:

1.  **Business Registration Certificate:** The official certificate proving your business registration with the Kenyan Business Registration Service (BRS).
2.  **Certificate of Registration Number:** The unique number found on your registration certificate.
3.  **KRA PIN (Personal or Business):** Your Kenya Revenue Authority Personal Identification Number. This can be either the director's/owner's personal KRA PIN or the business's KRA PIN.
4.  **Bank Account:** A Kenyan bank account. **Crucially, the bank account name must match the name on your Business Registration Certificate.**
5.  **Director/Owner Information:** Personal details of the business directors/owners.
6.  **Completed Profile:** Ensure all sections of your Paystack profile (Business Name, Address, Contact, etc.) are accurately filled.
7.  **Compliance Forms:** Accept the Merchant Service Agreement and complete any other required compliance forms on the Paystack dashboard.

**Process:**

*   Log in to your Paystack Dashboard.
*   Switch from Test Mode to Live Mode (or follow the activation prompts).
*   Navigate to the Compliance or Activation section.
*   Upload the required documents (Business Reg Cert, KRA PIN cert).
*   Enter your Certificate of Registration Number.
*   Add your bank account details.
*   Fill in director/owner information.
*   Submit the information for review by the Paystack team.
*   **Remember to also configure your live Webhook URL in the Paystack dashboard settings.**

Activation usually takes a few business days once all correct documentation is submitted.
