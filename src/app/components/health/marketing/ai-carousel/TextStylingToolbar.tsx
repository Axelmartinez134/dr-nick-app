'use client';

import { useState, useEffect } from 'react';

interface TextStylingToolbarProps {
  fabricCanvas: any;
}

export default function TextStylingToolbar({ fabricCanvas }: TextStylingToolbarProps) {
  const [selectedText, setSelectedText] = useState<any>(null);
  const [selectionInfo, setSelectionInfo] = useState<{
    start: number;
    end: number;
    isBold: boolean;
    isItalic: boolean;
  } | null>(null);

  useEffect(() => {
    // Verify canvas is valid and has required methods
    if (!fabricCanvas || typeof fabricCanvas.on !== 'function') {
      console.log('[Toolbar] ⏳ Canvas not ready yet');
      return;
    }

    const handleSelection = () => {
      const activeObject = fabricCanvas.getActiveObject();
      
      if (activeObject && activeObject.type === 'i-text') {
        const selStart = activeObject.selectionStart;
        const selEnd = activeObject.selectionEnd;
        
        // Only show toolbar if text is selected (not just cursor position)
        if (selStart !== selEnd) {
          setSelectedText(activeObject);
          
          // Get current styles of first character in selection
          const currentStyles = activeObject.getSelectionStyles(selStart, selEnd);
          const firstStyle = currentStyles[0] || {};
          
          setSelectionInfo({
            start: selStart,
            end: selEnd,
            isBold: firstStyle.fontWeight === 'bold',
            isItalic: firstStyle.fontStyle === 'italic',
          });
          
          console.log('[Toolbar] 📝 Text selected:', {
            text: activeObject.text.substring(selStart, selEnd),
            range: `${selStart}-${selEnd}`,
            bold: firstStyle.fontWeight === 'bold',
            italic: firstStyle.fontStyle === 'italic',
          });
        } else {
          setSelectedText(null);
          setSelectionInfo(null);
        }
      } else {
        setSelectedText(null);
        setSelectionInfo(null);
      }
    };

    // Listen for selection changes
    fabricCanvas.on('selection:created', handleSelection);
    fabricCanvas.on('selection:updated', handleSelection);
    fabricCanvas.on('selection:cleared', () => {
      setSelectedText(null);
      setSelectionInfo(null);
    });
    fabricCanvas.on('text:selection:changed', handleSelection);

    return () => {
      // Only remove listeners if canvas still has the off method
      if (fabricCanvas && typeof fabricCanvas.off === 'function') {
        fabricCanvas.off('selection:created', handleSelection);
        fabricCanvas.off('selection:updated', handleSelection);
        fabricCanvas.off('selection:cleared');
        fabricCanvas.off('text:selection:changed', handleSelection);
      }
    };
  }, [fabricCanvas]);

  const toggleBold = () => {
    if (!selectedText || !selectionInfo || !fabricCanvas) return;

    console.log('[Toolbar] 🎨 Toggling bold');
    const newWeight = selectionInfo.isBold ? 'normal' : 'bold';
    
    selectedText.setSelectionStyles(
      { fontWeight: newWeight },
      selectionInfo.start,
      selectionInfo.end
    );
    
    if (typeof fabricCanvas.renderAll === 'function') {
      fabricCanvas.renderAll();
    }
    
    setSelectionInfo({
      ...selectionInfo,
      isBold: !selectionInfo.isBold,
    });
    
    console.log('[Toolbar] ✅ Bold toggled to:', newWeight);
  };

  const toggleItalic = () => {
    if (!selectedText || !selectionInfo || !fabricCanvas) return;

    console.log('[Toolbar] 🎨 Toggling italic');
    const newStyle = selectionInfo.isItalic ? 'normal' : 'italic';
    
    selectedText.setSelectionStyles(
      { fontStyle: newStyle },
      selectionInfo.start,
      selectionInfo.end
    );
    
    if (typeof fabricCanvas.renderAll === 'function') {
      fabricCanvas.renderAll();
    }
    
    setSelectionInfo({
      ...selectionInfo,
      isItalic: !selectionInfo.isItalic,
    });
    
    console.log('[Toolbar] ✅ Italic toggled to:', newStyle);
  };

  const clearFormatting = () => {
    if (!selectedText || !selectionInfo || !fabricCanvas) return;

    console.log('[Toolbar] 🧹 Clearing formatting');
    
    selectedText.setSelectionStyles(
      { fontWeight: 'normal', fontStyle: 'normal' },
      selectionInfo.start,
      selectionInfo.end
    );
    
    if (typeof fabricCanvas.renderAll === 'function') {
      fabricCanvas.renderAll();
    }
    
    setSelectionInfo({
      ...selectionInfo,
      isBold: false,
      isItalic: false,
    });
    
    console.log('[Toolbar] ✅ Formatting cleared');
  };

  if (!selectionInfo) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex items-center justify-center space-x-2">
        <span className="text-sm text-gray-600 mr-2">Text Styling:</span>
        
        <button
          onClick={toggleBold}
          className={`px-4 py-2 rounded font-bold transition-colors ${
            selectionInfo.isBold
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          title="Toggle Bold"
        >
          B
        </button>
        
        <button
          onClick={toggleItalic}
          className={`px-4 py-2 rounded italic font-serif transition-colors ${
            selectionInfo.isItalic
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
          title="Toggle Italic"
        >
          I
        </button>
        
        <button
          onClick={clearFormatting}
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors text-sm"
          title="Clear Formatting"
        >
          Clear
        </button>
      </div>
      
      <p className="text-xs text-gray-500 mt-2 text-center">
        Selected {selectionInfo.end - selectionInfo.start} character(s)
      </p>
    </div>
  );
}

