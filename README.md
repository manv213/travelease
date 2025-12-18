# TravelEase

A Single Page Application (SPA) for AI-powered travel itinerary planning, built with React, Tailwind CSS, and Google Gemini API.

## Features

- **AI Itinerary Generation**: Uses Google Gemini to plan detailed trips based on destination, budget, and duration.
- **Visual Vibe Matching**: Upload an image to influence the "vibe" of your trip (multimodal AI).
- **Interactive Dashboard**: View daily plans and a simulated map visualization.
- **Real-time Adaptation**: Report issues (e.g., "Place closed") and get instant itinerary patches from the AI.
- **MVC Architecture**: Strict separation of Model, View, and Controller using React Hooks.

## Setup & Run

This project requires [Node.js](https://nodejs.org/) installed on your machine.

1.  Navigate to the project directory:
    ```bash
    cd travelease
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser to the URL shown (usually `http://localhost:5173`).

## Environment

The Gemini API Key is currently hardcoded for demonstration purposes. In a production app, use `.env` files.

## Tech Stack

- **Framework**: React (Vite)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI**: Google Gemini (`gemini-2.5-flash-preview`)
