import React from "react";
import DiscoverFeed from "./DiscoverFeed";

export default function DiscoverPage() {
  return (
    <div className="w-full pb-16">
      <div className="max-w-7xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-8 font-display">Discover</h1>
        <DiscoverFeed />
      </div>
    </div>
  );
}
