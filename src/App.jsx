import React, { useState } from "react";
import {
  Camera,
  MapPin,
  Calendar,
  DollarSign,
  Send,
  AlertCircle,
  Loader2,
  Map as MapIcon,
  Sun,
  Cloud,
  CloudRain
} from "lucide-react";

/* =========================
   MODEL (STATE)
========================= */
const useTravelModel = () => {
  const [step, setStep] = useState("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState({
    destination: "",
    budget: 2000,
    duration: 5,
    image: null,
    imageMimeType: null
  });
  const [itinerary, setItinerary] = useState(null);

  return {
    step,
    setStep,
    loading,
    setLoading,
    error,
    setError,
    inputs,
    setInputs,
    itinerary,
    setItinerary
  };
};

/* =========================
   HELPERS
========================= */
const aggregateGroupPreferences = (profiles) => {
  const freq = {};
  profiles.forEach(p =>
    p.visual_preferences.forEach(t => {
      freq[t] = (freq[t] || 0) + 1;
    })
  );
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
};

/* =========================
   CONTROLLER
========================= */
const useTravelController = (model) => {

  const handleInputChange = (field, value) => {
    model.setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      model.setInputs(prev => ({
        ...prev,
        image: reader.result.split(",")[1],
        imageMimeType: file.type
      }));
    };
    reader.readAsDataURL(file);
  };

  const generateItinerary = async () => {
    model.setLoading(true);
    model.setError(null);

    try {
      if (!model.inputs.destination.trim()) {
        throw new Error("Please provide a destination.");
      }

      if (!model.inputs.image) {
        throw new Error("Please upload an image (required).");
      }

      const duration = Number(model.inputs.duration) || 1;
      const budget = Number(model.inputs.budget) || 0;

      // 🔮 CLIP / Vision
      const visionRes = await fetch("http://localhost:5001/api/vision", {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: model.inputs.image,
          mimeType: model.inputs.imageMimeType
        })
      });

      if (!visionRes.ok) throw new Error("Vision API failed");
      const vision = await visionRes.json();

      aggregateGroupPreferences([
        {
          destination: model.inputs.destination,
          budget,
          duration,
          visual_preferences: vision.vibe_tags
        }
      ]);

      // 🌍 OSM Places
      const placesRes = await fetch(
        `http://localhost:5000/api/places?city=${model.inputs.destination}`
      );
      if (!placesRes.ok) throw new Error("Places API failed");

      const places = await placesRes.json();
      if (!Array.isArray(places) || places.length < 2) {
        throw new Error("Not enough places found");
      }

      const itinerary = {
        trip_summary: vision.trip_summary,
        vibe_tags: vision.vibe_tags,
        daily_plan: Array.from({ length: duration }).map((_, i) => ({
          day: i + 1,
          activities: [
            {
              name: places[(i * 2) % places.length].name,
              time: "09:00 AM",
              cost: Math.floor(budget / duration / 2),
              lat: places[(i * 2) % places.length].lat,
              lng: places[(i * 2) % places.length].lng
            },
            {
              name: places[(i * 2 + 1) % places.length].name,
              time: "01:00 PM",
              cost: Math.floor(budget / duration / 2),
              lat: places[(i * 2 + 1) % places.length].lat,
              lng: places[(i * 2 + 1) % places.length].lng
            }
          ]
        })),
        nearby_hotels: [
          {
            name: `${model.inputs.destination} Central Hotel`,
            lat: 50,
            lng: 50,
            price_per_night: Math.floor(budget / duration)
          }
        ]
      };

      model.setItinerary(itinerary);
      model.setStep("dashboard");

    } catch (err) {
      console.error(err);
      model.setError(err.message);
    } finally {
      model.setLoading(false);
    }
  };

  return {
    handleInputChange,
    handleImageUpload,
    generateItinerary
  };
};

/* =========================
   WEATHER (MOCK)
========================= */
const WeatherWidget = () => {
  const r = Math.random();
  const Icon = r > 0.6 ? Sun : r > 0.3 ? Cloud : CloudRain;
  return (
    <div className="flex items-center gap-2 text-sm bg-white/50 px-3 py-1 rounded-full">
      <Icon className="w-4 h-4" />
      <span>{Math.floor(20 + Math.random() * 10)}°C</span>
    </div>
  );
};

/* =========================
   UI (unchanged)
========================= */
// ⬇️ Your NavBarView, InputView, MapView, DashboardView stay EXACTLY the same ⬇️

/* =========================
   APP
========================= */
const InputView = ({ model, controller }) => {
  return (
    <div style={{ padding: 20 }}>
      <h3>Input Screen</h3>

      <input
        placeholder="Destination"
        value={model.inputs.destination}
        onChange={(e) =>
          controller.handleInputChange("destination", e.target.value)
        }
      />

      <br /><br />

      <input type="file" accept="image/*" onChange={controller.handleImageUpload} />

      <br /><br />

      <button onClick={controller.generateItinerary}>
        Generate Itinerary
      </button>

      {model.error && <p style={{ color: "red" }}>{model.error}</p>}
    </div>
  );
};

// ✅ Navbar
const NavBarView = () => {
  return (
    <div style={{ padding: 20, background: "#f0f0f0" }}>
      <h2>TravelEase</h2>
    </div>
  );
};

// ✅ Dashboard
const DashboardView = ({ model }) => {
  return (
    <div style={{ padding: 20 }}>
      <h3>Dashboard</h3>
      <pre>{JSON.stringify(model.itinerary, null, 2)}</pre>
    </div>
  );
};

// ✅ App (ROOT)
export default function App() {
  const model = useTravelModel();
  const controller = useTravelController(model);
  

  return (
    <div style={{ padding: 20 }}>
      <NavBarView />

      {model.step === "input" ? (
        <InputView model={model} controller={controller} />
      ) : (
        <DashboardView model={model} />
      )}
    </div>
  );
}
