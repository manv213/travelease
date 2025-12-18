import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Camera, MapPin, Calendar, DollarSign, Send, AlertCircle, Loader2, Map as MapIcon, Sun, Cloud, CloudRain } from 'lucide-react';

// --- API Key ---
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
console.log('🔑 API Key loaded:', GOOGLE_API_KEY ? 'YES ✅' : 'NO ❌');
console.log('🔑 First 10 chars:', GOOGLE_API_KEY?.substring(0, 10));
// --- Model (State Management) ---
const useTravelModel = () => {
    const [step, setStep] = useState('input'); // 'input' | 'dashboard'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [inputs, setInputs] = useState({
        destination: '',
        budget: 2000,
        duration: 5,
        image: null, // Base64 string
        imageMimeType: null,
    });
    const [itinerary, setItinerary] = useState(null);

    return {
        step, setStep,
        loading, setLoading,
        error, setError,
        inputs, setInputs,
        itinerary, setItinerary,
    };
};

// --- Controller (Business Logic & AI) ---
const useTravelController = (model) => {
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

    const handleInputChange = (field, value) => {
        model.setInputs(prev => ({ ...prev, [field]: value }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                model.setInputs(prev => ({
                    ...prev,
                    image: reader.result.split(',')[1],
                    imageMimeType: file.type
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const generateSystemPrompt = () => `
    You are an expert travel planner. Generate a detailed travel itinerary for the user.
    The response MUST be a valid JSON object strictly following this schema:
    {
      "trip_summary": "string describing the vibe and key highlights",
      "vibe_tags": ["string", "string", "string"],
      "daily_plan": [
        {
          "day": 1,
          "activities": [
            {
              "name": "Activity Name",
              "time": "09:00 AM",
              "cost": 50,
              "lat": 20,
              "lng": 30
            }
          ]
        }
      ],
      "nearby_hotels": [
        { "name": "Hotel Name", "lat": 25, "lng": 35, "price_per_night": 150 }
      ]
    }
    Constraints:
    - Coordinates (lat, lng) should be relative percentages (0-100) for visualization on a 2D box.
    - If an image is provided, analyze its "vibe" and tailor the trip accordingly (e.g., rustic, luxury, adventure).
    - Return ONLY valid JSON with no additional text or markdown formatting.
  `;

    const generateItinerary = async () => {
        model.setLoading(true);
        model.setError(null);
        try {
            // Basic validation
            if (!model.inputs.destination || String(model.inputs.destination).trim() === '') {
                model.setError('Please provide a destination.');
                model.setLoading(false);
                return;
            }

            // Ensure numeric values
            const duration = Number(model.inputs.duration) || 1;
            const budget = Number(model.inputs.budget) || 0;
            const modelGen = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const prompt = `Plan a ${duration}-day trip to ${model.inputs.destination} with a budget of $${budget}.`;

            const parts = [{ text: generateSystemPrompt() }, { text: prompt }];

            if (model.inputs.image) {
                parts.push({
                    inlineData: {
                        data: model.inputs.image,
                        mimeType: model.inputs.imageMimeType
                    }
                });
            }

            const result = await modelGen.generateContent(parts);
            const response = result.response;
            const text = response.text();

            // Basic cleanup for JSON parsing if markdown code blocks are present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            let data;
            try {
                data = JSON.parse(cleanText);
            } catch (jsonErr) {
                console.error('Failed to parse itinerary JSON:', jsonErr, '\nRaw response:', cleanText);
                throw new Error('AI returned invalid JSON format. Please try again.');
            }

            model.setItinerary(data);
            model.setStep('dashboard');
        } catch (err) {
            console.error("AI Error:", err);
            const errorMessage = err.message || "Failed to generate itinerary. Please try again.";
            model.setError(errorMessage);
        } finally {
            model.setLoading(false);
        }
    };

    const reportIssue = async (activity, dayIndex, currentItinerary) => {
        model.setLoading(true);
        try {
            // FIXED: Changed from "gemini-2.5-flash-preview" to "gemini-1.5-flash"
            const modelGen = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `
        The user reported an issue with "${activity.name}" on Day ${dayIndex + 1}: "Place is temporarily closed".
        Please update the provided JSON itinerary to replace this activity with a suitable alternative nearby.
        Keep the rest of the itinerary exactly the same.
        Return ONLY the updated valid JSON with no additional text.
      `;
            // Pass the current itinerary as context
            const parts = [
                { text: generateSystemPrompt() },
                { text: JSON.stringify(currentItinerary || {}) },
                { text: prompt }
            ];

            const result = await modelGen.generateContent(parts);
            const response = result.response;
            const text = response.text();

            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            try {
                const data = JSON.parse(cleanText);
                model.setItinerary(data);
            } catch (jsonErr) {
                console.error('Failed to parse adapted itinerary JSON:', jsonErr, '\nRaw response:', cleanText);
                model.setError('AI returned invalid JSON while adapting itinerary.');
            }
        } catch (err) {
            console.error("Adaptation Error:", err);
            model.setError("Could not update the plan. Try sticking to the original.");
        } finally {
            model.setLoading(false);
        }
    };

    return {
        handleInputChange,
        handleImageUpload,
        generateItinerary,
        reportIssue
    };
};

// --- Mock Weather ---
const WeatherWidget = () => {
    const r = Math.random();
    const Icon = r > 0.6 ? Sun : r > 0.3 ? Cloud : CloudRain;
    const temp = Math.floor(20 + Math.random() * 10);
    return (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm">
            <Icon className="w-4 h-4" />
            <span>{temp}°C</span>
        </div>
    );
};

// --- Views ---

const NavBarView = () => (
    <nav className="w-full h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 z-50">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <MapIcon className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">TravelEase</span>
        </div>
        <div className="flex gap-4">
            {/* Placeholder nav items */}
            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
        </div>
    </nav>
);

const InputView = ({ model, controller }) => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4 pt-20">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl grid md:grid-cols-2 overflow-hidden items-center">

            <div className="p-8 md:p-12 space-y-6">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Plan your dream trip.</h1>
                    <p className="text-gray-500">AI-powered itineraries tailored to your vibe.</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 ml-1">Where to?</label>
                        <div className="relative">
                            <MapPin className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Paris, Tokyo, New York..."
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700 placeholder-gray-400"
                                value={model.inputs.destination}
                                onChange={(e) => controller.handleInputChange('destination', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Budget ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
                                <input
                                    type="number"
                                    placeholder="2000"
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                                    value={model.inputs.budget}
                                    onChange={(e) => controller.handleInputChange('budget', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">Duration (Days)</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-3.5 text-gray-400 w-5 h-5" />
                                <input
                                    type="number"
                                    placeholder="5"
                                    min="1" max="14"
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium text-gray-700"
                                    value={model.inputs.duration}
                                    onChange={(e) => controller.handleInputChange('duration', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 ml-1">Vibe Match (Optional)</label>
                        <div className="relative group">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id="file-upload"
                                onChange={controller.handleImageUpload}
                            />
                            <label htmlFor="file-upload" className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors gap-2 text-gray-500 group-hover:text-blue-600">
                                <Camera className="w-5 h-5" />
                                <span className="font-medium">{model.inputs.image ? "Image Uploaded!" : "Upload an image for inspiration"}</span>
                            </label>
                        </div>
                    </div>
                </div>

                {model.error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {model.error}
                    </div>
                )}

                <button
                    onClick={controller.generateItinerary}
                    disabled={model.loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                    {model.loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                    {model.loading ? "Designing your trip..." : "Generate Itinerary"}
                </button>
            </div>

            <div className="hidden md:block h-full bg-gray-100 relative">
                <img
                    src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=2021&q=80"
                    alt="Travel"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-12">
                    <div className="text-white">
                        <p className="font-medium text-lg mb-2">Travel smarter.</p>
                        <div className="bg-white/20 backdrop-blur-md p-4 rounded-xl inline-block">
                            <WeatherWidget />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const MapView = ({ itinerary }) => {
    // A simplified illustrative map view where lat/lng are percentages 0-100
    if (!itinerary || !Array.isArray(itinerary.daily_plan) || !Array.isArray(itinerary.nearby_hotels)) {
        return (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-500 bg-gray-200 rounded-3xl border border-gray-300">
                No map data available
            </div>
        );
    }

    return (
        <div className="w-full h-full relative bg-gray-200 rounded-3xl overflow-hidden border border-gray-300 shadow-inner group">
            {/* Fake Map Grid Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }}></div>

            {/* River Decoration */}
            <svg className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,50 C150,100 350,0 500,50 S800,100 1000,50" stroke="currentColor" strokeWidth="20" fill="none" className="text-blue-500" />
            </svg>

            <div className="absolute top-4 right-4 bg-white/80 p-2 rounded-lg text-xs font-mono backdrop-blur">
                Interactive Map
            </div>

            {/* Render Activities */}
            {itinerary.daily_plan.map((day, dIdx) => (
                (Array.isArray(day.activities) ? day.activities : []).map((act, aIdx) => (
                    <div
                        key={`act-${dIdx}-${aIdx}`}
                        className="absolute w-8 h-8 -ml-4 -mt-4 transform hover:scale-125 transition-transform cursor-pointer z-10"
                        style={{ left: `${act.lng}%`, top: `${act.lat}%` }}
                        title={`${act.name} (${act.time})`}
                    >
                        <div className="w-full h-full rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-bold text-white bg-blue-500">
                            {aIdx + 1}
                        </div>
                    </div>
                ))
            ))}

            {/* Render Hotels */}
            {(Array.isArray(itinerary.nearby_hotels) ? itinerary.nearby_hotels : []).map((hotel, idx) => (
                <div
                    key={`hotel-${idx}`}
                    className="absolute w-6 h-6 -ml-3 -mt-3 z-0"
                    style={{ left: `${hotel.lng}%`, top: `${hotel.lat}%` }}
                    title={hotel.name}
                >
                    <div className="w-full h-full bg-indigo-600 rounded-sm rotate-45 shadow-sm border border-white"></div>
                </div>
            ))}
        </div>
    );
};

const DashboardView = ({ model, controller }) => {
    if (!model.itinerary) return null;

    return (
        <div className="min-h-screen pt-20 pb-8 px-4 md:px-8 bg-gray-50 flex flex-col md:flex-row gap-6">
            {/* Itinerary Column */}
            <div className="w-full md:w-5/12 h-[calc(100vh-8rem)] flex flex-col gap-6 overflow-hidden">
                <div className="shrink-0 space-y-2">
                    <h2 className="text-3xl font-bold text-gray-900">{model.inputs.destination}</h2>
                    <p className="text-gray-500 leading-relaxed">{model.itinerary.trip_summary}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                        {(Array.isArray(model.itinerary.vibe_tags) ? model.itinerary.vibe_tags : []).map(tag => (
                            <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold uppercase tracking-wider">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                    {(Array.isArray(model.itinerary.daily_plan) ? model.itinerary.daily_plan : []).map((day, idx) => (
                        <div key={idx} className="relative pl-8 border-l-2 border-dashed border-gray-200 ml-4 pb-8 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm"></div>
                            <h3 className="font-bold text-lg text-gray-800 mb-4">Day {day.day}</h3>

                            <div className="space-y-4">
                                {(Array.isArray(day.activities) ? day.activities : []).map((act, actIdx) => (
                                    <div key={actIdx} className="group bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-xs font-bold text-blue-500 uppercase mb-1 block">{act.time}</span>
                                                <h4 className="font-semibold text-gray-900">{act.name}</h4>
                                                <span className="text-xs text-gray-400 mt-1 block">Est. Cost: ${act.cost}</span>
                                            </div>
                                            {model.loading ? (
                                                <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
                                            ) : (
                                                <button
                                                    onClick={() => controller.reportIssue(act, idx, model.itinerary)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                                                >
                                                    <AlertCircle className="w-3 h-3" /> Report Issue
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Map Column */}
            <div className="hidden md:block flex-1 h-[calc(100vh-8rem)] sticky top-22">
                <MapView itinerary={model.itinerary} />
            </div>
        </div>
    );
};

// --- Main App Component ---
function App() {
    const model = useTravelModel();
    const controller = useTravelController(model);

    return (
        <div className="font-sans text-gray-900 selection:bg-blue-100">
            <NavBarView />
            {model.step === 'input' ? (
                <InputView model={model} controller={controller} />
            ) : (
                <DashboardView model={model} controller={controller} />
            )}
        </div>
    );
}

export default App;