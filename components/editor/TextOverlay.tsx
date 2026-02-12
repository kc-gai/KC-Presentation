"use client";

import { useState, useRef, useCallback } from "react";
import { Trash2 } from "lucide-react";
import type { TextElement } from "@/types/presentation";

interface TextOverlayProps {
  element: TextElement;
  activeLanguage: "original" | "ko" | "ja";
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TextElement>) => void;
  onDelete: () => void;
}

export default function TextOverlay({
  element,
  activeLanguage,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: TextOverlayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; elemX: number; elemY: number } | null>(null);

  const displayText = (() => {
    switch (activeLanguage) {
      case "ko":
        return element.textKo || element.text;
      case "ja":
        return element.textJa || element.text;
      default:
        return element.text;
    }
  })();

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditing(true);
      onSelect();
      setTimeout(() => {
        if (textRef.current) {
          textRef.current.focus();
          // Select all text
          const range = document.createRange();
          range.selectNodeContents(textRef.current);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 0);
    },
    [onSelect]
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (textRef.current) {
      const newText = textRef.current.innerText.normalize("NFC");
      if (activeLanguage === "original") {
        onUpdate({ text: newText });
      } else if (activeLanguage === "ko") {
        onUpdate({ textKo: newText });
      } else {
        onUpdate({ textJa: newText });
      }
    }
  }, [activeLanguage, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsEditing(false);
        textRef.current?.blur();
      }
      // Delete on Backspace when selected but not editing
      if (e.key === "Delete" && isSelected && !isEditing) {
        onDelete();
      }
    },
    [isSelected, isEditing, onDelete]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return;
      e.stopPropagation();
      onSelect();

      const parentRect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        elemX: element.x,
        elemY: element.y,
      };
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStartRef.current || !parentRect) return;
        const dx = ((moveEvent.clientX - dragStartRef.current.x) / parentRect.width) * 100;
        const dy = ((moveEvent.clientY - dragStartRef.current.y) / parentRect.height) * 100;
        const newX = Math.max(0, Math.min(100 - element.width, dragStartRef.current.elemX + dx));
        const newY = Math.max(0, Math.min(100 - element.height, dragStartRef.current.elemY + dy));
        onUpdate({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isEditing, element.x, element.y, element.width, element.height, onSelect, onUpdate]
  );

  return (
    <div
      className={`absolute group ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Border indicator */}
      <div
        className={`absolute inset-0 rounded-sm transition-all pointer-events-none ${
          isSelected
            ? "border-2 border-primary bg-blue-500/10"
            : "border border-transparent hover:border-primary/40 hover:bg-blue-500/5"
        }`}
      />

      {/* Text content */}
      <div
        ref={textRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={`
          w-full h-full overflow-hidden whitespace-pre-wrap break-words
          ${isEditing ? "outline-none ring-2 ring-primary bg-white/90 rounded-sm p-0.5" : ""}
        `}
        style={{
          fontSize: `${element.fontSize * 0.6}px`,
          color: element.fontColor,
          fontWeight: element.fontWeight,
          textAlign: element.textAlign,
          lineHeight: 1.2,
        }}
      >
        {displayText}
      </div>

      {/* Delete button */}
      {isSelected && !isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-3 -right-3 w-6 h-6 bg-danger text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-10"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
