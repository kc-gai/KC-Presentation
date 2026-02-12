"use client";

import { useState, useRef, useCallback } from "react";
import { Trash2, Move } from "lucide-react";
import type { ImageElement } from "@/types/presentation";

interface ImageOverlayProps {
  element: ImageElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ImageElement>) => void;
  onDelete: () => void;
}

export default function ImageOverlay({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: ImageOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    elemX: number;
    elemY: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    x: number;
    y: number;
    elemW: number;
    elemH: number;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect();

      const parentRect = (
        e.currentTarget as HTMLElement
      ).parentElement?.getBoundingClientRect();
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
        const dx =
          ((moveEvent.clientX - dragStartRef.current.x) / parentRect.width) *
          100;
        const dy =
          ((moveEvent.clientY - dragStartRef.current.y) / parentRect.height) *
          100;
        const newX = Math.max(
          0,
          Math.min(100 - element.width, dragStartRef.current.elemX + dx)
        );
        const newY = Math.max(
          0,
          Math.min(100 - element.height, dragStartRef.current.elemY + dy)
        );
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
    [element.x, element.y, element.width, element.height, onSelect, onUpdate]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect();

      const parentRect = (
        e.currentTarget as HTMLElement
      ).closest("[data-slide-canvas]")?.getBoundingClientRect();
      if (!parentRect) return;

      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        elemW: element.width,
        elemH: element.height,
      };
      setIsResizing(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeStartRef.current || !parentRect) return;
        const dx =
          ((moveEvent.clientX - resizeStartRef.current.x) / parentRect.width) *
          100;
        const dy =
          ((moveEvent.clientY - resizeStartRef.current.y) / parentRect.height) *
          100;

        // Maintain aspect ratio
        const aspectRatio = element.originalWidth / element.originalHeight;
        const slideAspect =
          parentRect.width / parentRect.height;

        let newW = Math.max(5, resizeStartRef.current.elemW + dx);
        let newH = newW / aspectRatio / slideAspect * 100;

        // Use dy if it produces a larger change
        const newHFromDy = Math.max(5, resizeStartRef.current.elemH + dy);
        if (Math.abs(dy) > Math.abs(dx)) {
          newH = newHFromDy;
          newW = newH * aspectRatio * slideAspect / 100;
        } else {
          newH = newW / aspectRatio * (parentRect.height / parentRect.width) * 100;
        }

        newW = Math.min(100 - element.x, newW);
        newH = Math.min(100 - element.y, newH);

        onUpdate({ width: newW, height: newH });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        resizeStartRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element, onSelect, onUpdate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Delete" && isSelected) {
        onDelete();
      }
    },
    [isSelected, onDelete]
  );

  return (
    <div
      className={`absolute group ${isDragging ? "cursor-grabbing" : "cursor-grab"} ${isResizing ? "cursor-nwse-resize" : ""}`}
      style={{
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`,
      }}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Border indicator */}
      <div
        className={`absolute inset-0 rounded-sm transition-all pointer-events-none ${
          isSelected
            ? "border-2 border-green-500 bg-green-500/5"
            : "border border-transparent hover:border-green-500/40 hover:bg-green-500/5"
        }`}
      />

      {/* Image content */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={element.imageUrl}
        alt="Extracted image"
        className="w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {/* Move indicator */}
      {isSelected && (
        <div className="absolute top-1 left-1 w-5 h-5 bg-green-500 text-white rounded flex items-center justify-center pointer-events-none z-10">
          <Move className="w-3 h-3" />
        </div>
      )}

      {/* Resize handle */}
      {isSelected && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-green-500 border-2 border-white rounded-sm cursor-nwse-resize z-10 shadow-md"
        />
      )}

      {/* Delete button */}
      {isSelected && (
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
