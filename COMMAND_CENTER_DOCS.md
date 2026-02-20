# Command Center - Developer Documentation

**Version 1.3.0** | **Last Updated:** 2026-02-20

This document provides detailed developer documentation for the OffGrid AI Command Center, the premium tier of the Online ToolKit.

---

## 1. The AI Council

The core of the Command Center is the AI Council, a multi-model system designed to provide robust, well-rounded answers by leveraging the unique strengths of four specialist AI models.

### 1.1. Council Members

| Name | Model | Role | Strengths |
|---|---|---|---|
| **Scout** | `openai/gpt-5.2` | Vision Specialist | Excels at image analysis, visual data interpretation, and generating descriptive text from images. |
| **Medic** | `anthropic/claude-sonnet-4.6` | Safety & Analysis | Focused on safety, risk assessment, and providing cautious, well-reasoned analysis, especially for medical and survival scenarios. |
| **Navigator** | `google/gemini-3.1-pro-preview` | Research & Planning | Specialized in research, planning, and synthesizing information to create structured, actionable plans. |
| **Ranger** | `x-ai/grok-4.1-fast` | Creative Solutions | Provides creative, unconventional, and out-of-the-box solutions to complex problems. |

### 1.2. Council Workflow

The AI Council operates in two modes: **Council Mode** and **Command Mode**.

#### Council Mode

In Council Mode, the user's prompt is sent to all four council members in parallel. The responses are then streamed back to the user as they are completed, allowing the user to see the different perspectives of each AI.

#### Command Mode

In Command Mode, the process is as follows:
1.  The user's prompt is sent to all four council members in parallel.
2.  The responses from each council member are collected.
3.  A fifth AI, the **Chairman**, reviews the four responses and the original prompt.
4.  The Chairman synthesizes the information, resolves any conflicts, and provides a single, comprehensive, and authoritative final answer.

### 1.3. Timeouts

To ensure a responsive user experience, the council operates with strict timeouts:
*   **Model Timeout**: Each council member has **45 seconds** to provide its initial response.
*   **Review Timeout**: The Chairman has **30 seconds** to review the council's responses and provide a final answer.

If a model or the Chairman times out, it is gracefully skipped, and the process continues with the available responses.

## 2. Image Studio

The Image Studio is an AI-assisted image generation suite powered by **Nano Banana Pro** (`google/gemini-3-pro-image-preview`).

### 2.1. Core Features

*   **Text-to-Image Generation**: Creates high-quality images from text prompts.
*   **Prompt Crafting**: An AI-assisted feature that takes a simple user query and expands it into a detailed, optimized prompt for the image generation model.
*   **Visual Prompt from Conversation**: A feature that analyzes a conversation and generates a relevant image prompt to create a visual companion for the text.

### 2.2. Image Generation Health Check

The image generation service has a dedicated health check endpoint at `/api/health/image-gen`. This endpoint performs a live test of the image generation model and returns statistics on recent performance, including:
*   Success and failure rates
*   Average response times
*   A log of the last 10 image generation attempts (without prompts or user data)

A standalone health check script (`scripts/health-check.sh`) is also available for manual or automated monitoring.

## 3. Knowledge Base & Save System

The Command Center extends the save functionality of the free toolkit.

*   **Save to Knowledge Base**: Conversations can be saved as local Markdown (`.md`) files.
*   **Image Handling**: When a conversation that includes images is saved, the images are extracted and saved as separate files (e.g., `.png`, `.jpeg`) in the same directory as the Markdown file. The Markdown file is updated to reference the images using relative paths.
*   **PDF Export**: Conversations can be exported as styled PDF documents, with images embedded directly in the PDF.

## 4. Ready-Made Prompts

The Command Center includes a library of ready-made prompts, accessible at `/command/ready-made-prompts`. These prompts are designed for common off-grid scenarios and can be used to quickly get high-quality answers from the AI Council.

---

*For information on API endpoints, environment variables, and deployment, please refer to the main **Technical Overview** document.*
