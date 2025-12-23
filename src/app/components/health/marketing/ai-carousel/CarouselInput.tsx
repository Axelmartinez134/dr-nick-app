'use client';

import { useState } from 'react';
import { CarouselTextRequest } from '@/lib/carousel-types';

interface CarouselInputProps {
  onGenerate: (data: CarouselTextRequest) => void;
  loading: boolean;
  onClear?: () => void;
}

export default function CarouselInput({ onGenerate, loading, onClear }: CarouselInputProps) {
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#000000');
  const [includeImage, setIncludeImage] = useState(true);
  const [imagePrompt, setImagePrompt] = useState('');

  const handleSubmit = () => {
    if (!headline.trim()) {
      alert('Please enter a headline');
      return;
    }
    if (!body.trim()) {
      alert('Please enter body text');
      return;
    }
    
    onGenerate({
      headline: headline.trim(),
      body: body.trim(),
      settings: { 
        backgroundColor, 
        textColor,
        includeImage,
        imagePrompt: imagePrompt.trim() || undefined,
      },
    });
  };

  const handleClear = () => {
    setHeadline('');
    setBody('');
    setBackgroundColor('#ffffff');
    setTextColor('#000000');
    setIncludeImage(true);
    setImagePrompt('');
    if (onClear) onClear();
  };

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Carousel Text</h2>
        <button
          onClick={handleClear}
          disabled={loading}
          className="text-sm text-gray-900 hover:text-gray-700 disabled:text-gray-400"
        >
          Clear
        </button>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Headline ({headline.length} characters)
        </label>
        <textarea
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          rows={2}
          className="w-full border rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your headline..."
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">
          Body ({body.length} characters)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full border rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your body text..."
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Background Color</label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              disabled={loading}
              className="w-12 h-10 rounded cursor-pointer border"
            />
            <input
              type="text"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              disabled={loading}
              className="flex-1 border rounded px-2 py-1 text-sm text-gray-900"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Text Color</label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              disabled={loading}
              className="w-12 h-10 rounded cursor-pointer border"
            />
            <input
              type="text"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              disabled={loading}
              className="flex-1 border rounded px-2 py-1 text-sm text-gray-900"
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center space-x-2 mb-3">
          <input
            type="checkbox"
            id="includeImage"
            checked={includeImage}
            onChange={(e) => setIncludeImage(e.target.checked)}
            disabled={loading}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="includeImage" className="text-sm font-medium text-gray-900">
            🎨 Include AI-Generated Image
          </label>
        </div>

        {includeImage && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Custom Image Prompt (optional)
            </label>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Leave empty to auto-generate from headline and body..."
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              If empty, we'll create a medical illustration prompt from your headline and body.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !headline.trim() || !body.trim()}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {loading ? 'Generating Layout...' : '✨ Generate Layout'}
      </button>
    </div>
  );
}

