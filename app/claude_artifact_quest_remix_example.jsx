import React, { useState, useRef, useMemo } from 'react';
import { Book, Music, Shuffle, ChevronLeft, ChevronRight, Check, X, Play, Clock, Layers, ChevronDown, ChevronUp, Merge, Split, Plus, FileText } from 'lucide-react';

// Sample data structure
const initialData = {
  books: [
    {
      id: 'genesis',
      name: 'Genesis',
      chapters: [
        {
          id: 'gen-1',
          number: 1,
          totalVerses: 12,
          versions: [
            {
              id: 'v3',
              name: 'Full Chapter',
              createdAt: '2024-01-15',
              color: 'indigo',
              assets: [
                { id: 'a1', startVerse: 1, endVerse: 3, recordings: [{ id: 'r1', name: 'Take 1', duration: '1:34' }, { id: 'r2', name: 'Take 2', duration: '1:41' }] },
                { id: 'a2', startVerse: 4, endVerse: 6, recordings: [{ id: 'r3', name: 'Studio Mix', duration: '2:12' }] },
                { id: 'a3', startVerse: 7, endVerse: 9, recordings: [{ id: 'r4', name: 'Draft', duration: '2:55' }, { id: 'r5', name: 'Final', duration: '2:48' }] },
                { id: 'a4', startVerse: 10, endVerse: 12, recordings: [{ id: 'r7', name: 'Recording A', duration: '2:22' }] },
              ]
            },
            {
              id: 'v2',
              name: 'Partial B',
              createdAt: '2024-01-10',
              color: 'emerald',
              assets: [
                { id: 'a5', startVerse: 1, endVerse: 3, recordings: [{ id: 'r8', name: 'Main', duration: '1:44' }] },
                { id: 'a6', startVerse: 4, endVerse: 6, recordings: [{ id: 'r9', name: 'Take 1', duration: '2:11' }, { id: 'r10', name: 'Take 2', duration: '2:08' }] },
                { id: 'a6b', startVerse: 7, endVerse: 12, recordings: [{ id: 'r9b', name: 'Long', duration: '4:30' }] },
              ]
            },
            {
              id: 'v1',
              name: 'Partial A',
              createdAt: '2024-01-05',
              color: 'amber',
              assets: [
                { id: 'a7', startVerse: 1, endVerse: 3, recordings: [{ id: 'r11', name: 'Original', duration: '1:55' }] },
                { id: 'a8', startVerse: 3, endVerse: 3, recordings: [{ id: 'r12', name: 'Alt v3', duration: '0:42' }] },
                { id: 'a9', startVerse: 4, endVerse: 9, recordings: [{ id: 'r13', name: 'Long take', duration: '4:22' }] },
              ]
            },
          ]
        },
        {
          id: 'gen-2',
          number: 2,
          totalVerses: 10,
          versions: [
            {
              id: 'v4',
              name: 'Complete',
              createdAt: '2024-01-12',
              color: 'indigo',
              assets: [
                { id: 'a9', startVerse: 1, endVerse: 5, recordings: [{ id: 'r13', name: 'Recording', duration: '3:15' }] },
                { id: 'a10', startVerse: 6, endVerse: 10, recordings: [{ id: 'r14', name: 'Main', duration: '3:42' }] },
              ]
            }
          ]
        },
      ]
    },
    {
      id: 'psalms',
      name: 'Psalms',
      chapters: [
        {
          id: 'ps-23',
          number: 23,
          totalVerses: 6,
          versions: [
            {
              id: 'v6',
              name: 'Musical',
              createdAt: '2024-01-14',
              color: 'rose',
              assets: [
                { id: 'a12', startVerse: 1, endVerse: 3, recordings: [{ id: 'r16', name: 'Sung', duration: '2:10' }] },
                { id: 'a13', startVerse: 4, endVerse: 6, recordings: [{ id: 'r17', name: 'Sung', duration: '2:05' }] },
              ]
            },
            {
              id: 'v7',
              name: 'Spoken',
              createdAt: '2024-01-11',
              color: 'cyan',
              assets: [
                { id: 'a14', startVerse: 1, endVerse: 3, recordings: [{ id: 'r18', name: 'Take 1', duration: '1:15' }] },
                { id: 'a15', startVerse: 4, endVerse: 6, recordings: [{ id: 'r19', name: 'Take 1', duration: '2:30' }] },
              ]
            }
          ]
        }
      ]
    }
  ]
};

const colorMap = {
  indigo: { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700', accent: 'bg-indigo-500', light: 'bg-indigo-50' },
  emerald: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', accent: 'bg-emerald-500', light: 'bg-emerald-50' },
  amber: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', accent: 'bg-amber-500', light: 'bg-amber-50' },
  rose: { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700', accent: 'bg-rose-500', light: 'bg-rose-50' },
  cyan: { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700', accent: 'bg-cyan-500', light: 'bg-cyan-50' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', accent: 'bg-purple-500', light: 'bg-purple-50' },
};

// Draggable Horizontal Scroll Component
const DraggableScroll = ({ children, className = '' }) => {
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  const handleTouchMove = (e) => {
    const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  return (
    <div
      ref={scrollRef}
      className={`overflow-x-auto cursor-grab select-none ${className}`}
      style={{ 
        scrollbarWidth: 'none', 
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {children}
    </div>
  );
};

// Stacked Version Cards Component
const StackedVersionCards = ({ versions, onVersionTap }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleMouseDown = (e) => {
    startX.current = e.clientX;
    currentX.current = e.clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    currentX.current = e.touches[0].clientX;
    setOffset(currentX.current - startX.current);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    currentX.current = e.clientX;
    setOffset(currentX.current - startX.current);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    const diff = currentX.current - startX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (diff < 0 && currentIndex < versions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
    setOffset(0);
    setIsDragging(false);
  };

  const version = versions[currentIndex];
  const colors = colorMap[version.color] || colorMap.indigo;

  return (
    <div 
      className="relative h-32 flex-1"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      {/* Background stack cards */}
      {versions.slice(0, 3).map((v, idx) => {
        if (idx === 0) return null;
        const stackColors = colorMap[versions[Math.min(currentIndex + idx, versions.length - 1)]?.color] || colorMap.indigo;
        return (
          <div
            key={`stack-${idx}`}
            className={`absolute inset-0 rounded-2xl border-2 ${stackColors.border} ${stackColors.light}`}
            style={{
              transform: `translateX(${idx * 6}px) translateY(${idx * 4}px)`,
              zIndex: 3 - idx,
              opacity: 1 - idx * 0.2
            }}
          />
        );
      })}
      
      {/* Active card */}
      <div
        className={`absolute inset-0 rounded-2xl border-2 ${colors.border} ${colors.bg} shadow-lg cursor-grab active:cursor-grabbing transition-transform duration-150`}
        style={{
          transform: isDragging ? `translateX(${offset}px) rotate(${offset * 0.05}deg)` : 'none',
          zIndex: 10
        }}
        onDoubleClick={() => onVersionTap(version)}
      >
        <div className="p-3 h-full flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-1.5">
            <div className={`w-3 h-3 rounded-full ${colors.accent}`} />
            {currentIndex === 0 && (
              <span className="text-[10px] bg-white/60 text-gray-600 px-1.5 py-0.5 rounded-full">Latest</span>
            )}
          </div>
          <h4 className={`font-semibold text-sm ${colors.text} truncate leading-tight`}>
            {version.name}
          </h4>
          <p className="text-[11px] text-gray-500 mt-1">{version.createdAt}</p>
          <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-auto pt-1">
            <Layers size={10} />
            <span>{version.assets.length} assets</span>
            <span className="mx-1">•</span>
            <Music size={10} />
            <span>{version.assets.reduce((sum, a) => sum + a.recordings.length, 0)} rec</span>
          </div>
          
          {/* Pagination dots */}
          {versions.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {versions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentIndex ? `${colors.accent} w-4` : 'bg-gray-300 w-1.5'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Swipe hint */}
      {versions.length > 1 && (
        <div className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-gray-400">
          ← Swipe for {versions.length} versions →
        </div>
      )}
    </div>
  );
};

// Chapter Row with Stacked Cards and Action Buttons
const ChapterRow = ({ chapter, onVersionTap, onNewVersion, onRemix }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-bold text-gray-700">Chapter {chapter.number}</h3>
        <span className="text-xs text-gray-400">{chapter.totalVerses} verses</span>
      </div>
      
      <div className="flex gap-3 items-start">
        {/* Stacked Version Cards */}
        <StackedVersionCards 
          versions={chapter.versions}
          onVersionTap={(version) => onVersionTap(chapter, version)}
        />
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onNewVersion(chapter)}
            className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center active:bg-blue-200 transition-colors shadow-sm border border-blue-200"
            title="New Version"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => onRemix(chapter)}
            className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center active:bg-purple-200 transition-colors shadow-sm border border-purple-200"
            title="Create Remix"
          >
            <Shuffle size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Asset List View
const AssetListView = ({ version, chapter, onBack, onRemix }) => {
  const [expandedAsset, setExpandedAsset] = useState(null);
  const colors = colorMap[version.color] || colorMap.indigo;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className={`${colors.bg} border-b ${colors.border} px-4 py-3 flex items-center gap-3`}>
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-white/50">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h2 className={`font-bold ${colors.text}`}>{version.name}</h2>
          <p className="text-xs text-gray-600">Chapter {chapter.number} • {version.assets.length} assets</p>
        </div>
        <button
          onClick={onRemix}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium shadow-sm active:bg-purple-700"
        >
          <Shuffle size={16} />
          Remix
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {version.assets.map(asset => (
            <div
              key={asset.id}
              className={`bg-white rounded-2xl border-2 ${colors.border} overflow-hidden`}
            >
              <button
                onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
                className="w-full p-4 flex items-center justify-between text-left active:bg-gray-50"
              >
                <div>
                  <span className={`font-semibold ${colors.text}`}>
                    {asset.startVerse === asset.endVerse 
                      ? `Verse ${asset.startVerse}`
                      : `Verses ${asset.startVerse}–${asset.endVerse}`
                    }
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Music size={12} className="text-gray-400" />
                    <span className="text-xs text-gray-500">
                      {asset.recordings.length} recording{asset.recordings.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {expandedAsset === asset.id ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>
              
              {expandedAsset === asset.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                  {asset.recordings.map(rec => (
                    <div key={rec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <button className={`w-10 h-10 rounded-full ${colors.accent} text-white flex items-center justify-center shadow-sm`}>
                          <Play size={14} fill="white" />
                        </button>
                        <span className="text-sm font-medium text-gray-700">{rec.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={12} />
                        <span>{rec.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Selected Items Stack Component
const SelectedStack = ({ items, onRemove }) => {
  if (items.length === 0) {
    return (
      <div className="h-full min-h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
        <span className="text-[10px] text-gray-400">Empty</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      {items.map((item, idx) => {
        const colors = colorMap[item.version.color] || colorMap.indigo;
        return (
          <button
            key={item.id + '-' + idx}
            onClick={() => onRemove(idx)}
            className={`w-full p-1.5 rounded-lg ${colors.bg} ${colors.border} border text-left transition-all active:scale-95 relative group`}
          >
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${colors.accent} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-medium text-gray-700 truncate">
                  {item.type === 'recording' ? item.recording.name : `Asset: ${item.asset.recordings.length} rec`}
                </p>
                <p className="text-[8px] text-gray-500 truncate">{item.version.name}</p>
              </div>
              <X size={10} className="text-gray-400 group-active:text-red-500 flex-shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
};

// Remix Verse Row Component
const RemixVerseRow = ({ 
  verseRange,
  selectedItems,
  versionOptions, 
  onAddItem,
  onRemoveItem,
  expandedCard,
  onExpandCard,
  canSplitUp,
  canMergeDown,
  onSplit,
  onMerge,
  isAutoMerged
}) => {
  const verseLabel = verseRange.length === 1 
    ? verseRange[0] 
    : `${verseRange[0]}–${verseRange[verseRange.length - 1]}`;
  
  const isItemSelected = (item) => {
    return selectedItems.some(sel => {
      if (item.type === 'recording' && sel.type === 'recording') {
        return sel.recording.id === item.recording.id;
      }
      if (item.type === 'asset' && sel.type === 'asset') {
        return sel.asset.id === item.asset.id;
      }
      return false;
    });
  };

  return (
    <div className={`flex gap-2 border-b border-gray-100 py-3 ${isAutoMerged ? 'bg-purple-50/50' : ''}`}>
      {/* Verse Number + Merge/Split Controls */}
      <div className="w-12 flex-shrink-0 flex flex-col items-center pt-1 gap-1">
        <span className="text-xs font-bold text-gray-500">{verseLabel}</span>
        <div className="flex flex-col gap-0.5">
          {canSplitUp && (
            <button
              onClick={onSplit}
              className="p-1 rounded bg-orange-100 text-orange-600 active:bg-orange-200"
              title="Split"
            >
              <Split size={10} />
            </button>
          )}
          {canMergeDown && (
            <button
              onClick={onMerge}
              className="p-1 rounded bg-blue-100 text-blue-600 active:bg-blue-200"
              title="Merge with next"
            >
              <Merge size={10} />
            </button>
          )}
        </div>
        {isAutoMerged && (
          <span className="text-[8px] text-purple-500 font-medium">AUTO</span>
        )}
      </div>
      
      {/* Selected Column */}
      <div className="w-24 flex-shrink-0">
        <SelectedStack items={selectedItems} onRemove={onRemoveItem} />
      </div>
      
      {/* Version Options - Draggable Horizontal Scroll */}
      <div className="flex-1 overflow-hidden relative">
        <DraggableScroll className="flex gap-2 pb-1">
          {versionOptions.length === 0 ? (
            <div className="flex-shrink-0 w-32 h-20 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
              <span className="text-xs text-gray-400">No content</span>
            </div>
          ) : (
            versionOptions.map(opt => {
              const colors = colorMap[opt.version.color] || colorMap.indigo;
              const cardKey = `${verseRange.join('-')}-${opt.asset.id}`;
              const isExpanded = expandedCard === cardKey;
              
              return (
                <div
                  key={`${opt.version.id}-${opt.asset.id}`}
                  className={`flex-shrink-0 ${isExpanded ? 'w-52' : 'w-36'} rounded-xl border-2 transition-all border-gray-200 bg-white`}
                >
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${colors.accent}`} />
                        <span className="text-[10px] font-medium text-gray-600 truncate">{opt.version.name}</span>
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-gray-500 mb-2">
                      {opt.asset.startVerse === opt.asset.endVerse 
                        ? `v${opt.asset.startVerse}`
                        : `vv${opt.asset.startVerse}–${opt.asset.endVerse}`
                      }
                      <span className="text-gray-400 ml-1">• {opt.asset.recordings.length} rec</span>
                    </p>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const item = { 
                            version: opt.version, 
                            asset: opt.asset, 
                            type: 'asset',
                            id: `asset-${opt.asset.id}`
                          };
                          if (!isItemSelected(item)) {
                            onAddItem(item);
                          }
                        }}
                        disabled={isItemSelected({ type: 'asset', asset: opt.asset })}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          isItemSelected({ type: 'asset', asset: opt.asset })
                            ? 'bg-gray-200 text-gray-400'
                            : 'bg-purple-100 text-purple-700 active:bg-purple-200'
                        }`}
                      >
                        {isItemSelected({ type: 'asset', asset: opt.asset }) ? 'Added' : '+ Add All'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExpandCard(isExpanded ? null : cardKey);
                        }}
                        className="p-1.5 rounded-lg bg-gray-100 text-gray-500 active:bg-gray-200"
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded Recordings */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-2 space-y-1.5 max-h-40 overflow-y-auto">
                      <p className="text-[10px] text-gray-500 font-medium">Tap to add recordings:</p>
                      {opt.asset.recordings.map(rec => {
                        const recItem = { 
                          type: 'recording', 
                          recording: rec,
                          version: opt.version,
                          asset: opt.asset,
                          id: `rec-${rec.id}`
                        };
                        const isRecSelected = isItemSelected(recItem);
                        return (
                          <button
                            key={rec.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isRecSelected) {
                                onAddItem(recItem);
                              }
                            }}
                            disabled={isRecSelected}
                            className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-left transition-colors ${
                              isRecSelected 
                                ? 'bg-gray-100 opacity-50' 
                                : 'bg-gray-50 active:bg-purple-50'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full ${colors.accent} text-white flex items-center justify-center`}>
                              <Play size={10} fill="white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium text-gray-700 truncate">{rec.name}</p>
                              <p className="text-[9px] text-gray-400">{rec.duration}</p>
                            </div>
                            {isRecSelected ? (
                              <Check size={12} className="text-gray-400" />
                            ) : (
                              <span className="text-[9px] text-purple-600 font-medium">+ Add</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </DraggableScroll>
        
        {/* Scroll hint gradient */}
        {versionOptions.length > 2 && (
          <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
};

// Calculate auto-merge groups based on common coverage across all versions
const calculateAutoMergeGroups = (totalVerses, versions) => {
  const groups = [];

  for (let v = 1; v <= totalVerses; v++) {
    // For each verse, find if ALL versions have an asset that starts at the same verse
    const assetsAtVerse = versions.map(version => {
      return version.assets.filter(a => v >= a.startVerse && v <= a.endVerse);
    });

    // Check if all versions have coverage at this verse
    const allHaveCoverage = assetsAtVerse.every(assets => assets.length > 0);
    
    if (!allHaveCoverage) {
      groups.push({ verses: [v], isAuto: false });
      continue;
    }

    // Find common asset boundaries - check if all versions have an asset starting at v
    const allStartAtV = versions.every(version => 
      version.assets.some(a => a.startVerse === v)
    );

    if (allStartAtV) {
      // Find the minimum end verse across all versions for assets starting at v
      const minEnd = Math.min(...versions.map(version => {
        const asset = version.assets.find(a => a.startVerse === v);
        return asset ? asset.endVerse : v;
      }));

      // Check if all versions have the same end for this start
      const allHaveSameRange = versions.every(version => {
        const asset = version.assets.find(a => a.startVerse === v);
        return asset && asset.endVerse >= minEnd;
      });

      if (allHaveSameRange && minEnd > v) {
        // Create a merged group
        const range = [];
        for (let i = v; i <= minEnd; i++) range.push(i);
        groups.push({ verses: range, isAuto: true });
        // Skip ahead
        v = minEnd;
        continue;
      }
    }

    // Otherwise, single verse
    groups.push({ verses: [v], isAuto: false });
  }

  return groups;
};

// Remix View
const RemixView = ({ chapter, versions, onCancel, onSave }) => {
  const [remixName, setRemixName] = useState('');
  const [selections, setSelections] = useState({});
  const [expandedCard, setExpandedCard] = useState(null);
  const [manualMerges, setManualMerges] = useState([]);
  const [manualSplits, setManualSplits] = useState([]); // Track split verses

  // Calculate auto-merged groups
  const autoGroups = useMemo(() => 
    calculateAutoMergeGroups(chapter.totalVerses, versions),
    [chapter.totalVerses, versions]
  );

  // Combine auto groups with manual merges and splits
  const verseGroups = useMemo(() => {
    // Start by expanding auto groups into individual verses where manually split
    let groups = [];
    
    autoGroups.forEach(group => {
      // Check if any verse in this group was manually split
      const shouldSplit = group.verses.some(v => manualSplits.includes(v));
      
      if (shouldSplit && group.verses.length > 1) {
        // Split into individual verses
        group.verses.forEach(v => {
          groups.push({ verses: [v], isAuto: false, wasSplit: true });
        });
      } else {
        groups.push({ ...group, wasSplit: false });
      }
    });
    
    // Apply manual merges
    manualMerges.forEach(merge => {
      const mergeSet = new Set(merge);
      const affectedIndices = [];
      
      groups.forEach((group, idx) => {
        if (group.verses.some(v => mergeSet.has(v))) {
          affectedIndices.push(idx);
        }
      });

      if (affectedIndices.length > 1) {
        // Combine all affected groups
        const combined = new Set();
        affectedIndices.forEach(idx => {
          groups[idx].verses.forEach(v => combined.add(v));
        });
        merge.forEach(v => combined.add(v));
        
        // Remove old groups (in reverse to maintain indices)
        const removedGroups = [];
        for (let i = affectedIndices.length - 1; i >= 0; i--) {
          removedGroups.unshift(groups.splice(affectedIndices[i], 1)[0]);
        }
        
        // Add combined group in sorted order
        const newGroup = { 
          verses: Array.from(combined).sort((a, b) => a - b), 
          isAuto: false,
          wasSplit: false
        };
        const insertIdx = groups.findIndex(g => g.verses[0] > newGroup.verses[0]);
        if (insertIdx === -1) {
          groups.push(newGroup);
        } else {
          groups.splice(insertIdx, 0, newGroup);
        }
      }
    });

    return groups;
  }, [autoGroups, manualMerges, manualSplits]);

  // Get options for a verse range
  const getOptionsForRange = (verseRange) => {
    const options = [];
    const startV = verseRange[0];
    const endV = verseRange[verseRange.length - 1];
    
    versions.forEach(version => {
      version.assets.forEach(asset => {
        if (asset.startVerse <= endV && asset.endVerse >= startV) {
          options.push({ version, asset });
        }
      });
    });
    return options;
  };

  const getVerseKey = (range) => range.join('-');

  const handleAddItem = (verseRange, item) => {
    const key = getVerseKey(verseRange);
    setSelections(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), item]
    }));
  };

  const handleRemoveItem = (verseRange, index) => {
    const key = getVerseKey(verseRange);
    setSelections(prev => {
      const newItems = [...(prev[key] || [])];
      newItems.splice(index, 1);
      return {
        ...prev,
        [key]: newItems
      };
    });
  };

  const handleMerge = (groupIndex) => {
    if (groupIndex >= verseGroups.length - 1) return;
    const currentGroup = verseGroups[groupIndex];
    const nextGroup = verseGroups[groupIndex + 1];
    const mergedRange = [...currentGroup.verses, ...nextGroup.verses];
    
    // Remove any splits that would conflict
    setManualSplits(prev => prev.filter(v => !mergedRange.includes(v)));
    setManualMerges(prev => [...prev, mergedRange]);
  };

  const handleSplit = (groupIndex) => {
    const group = verseGroups[groupIndex];
    if (group.verses.length <= 1) return;
    
    // Add all verses to manual splits
    setManualSplits(prev => [...new Set([...prev, ...group.verses])]);
    
    // Remove any manual merge that includes these verses
    setManualMerges(prev => prev.filter(merge => {
      return !group.verses.some(v => merge.includes(v));
    }));
  };

  const totalSelected = Object.values(selections).reduce((sum, items) => sum + items.length, 0);
  const filledSlots = Object.keys(selections).filter(k => selections[k]?.length > 0).length;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shuffle size={20} />
            <span className="font-bold">Remix Chapter {chapter.number}</span>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl bg-white/20 active:bg-white/30">
            <X size={20} />
          </button>
        </div>
        <input
          type="text"
          placeholder="Name your remix..."
          value={remixName}
          onChange={(e) => setRemixName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-white/20 placeholder-white/60 text-white border border-white/30 focus:outline-none focus:bg-white/30"
        />
      </div>
      
      {/* Legend */}
      <div className="px-4 py-2 bg-gray-50 border-b text-[10px] text-gray-500 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <Merge size={10} className="text-blue-500" />
          <span>Merge</span>
        </div>
        <div className="flex items-center gap-1">
          <Split size={10} className="text-orange-500" />
          <span>Split</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-200 rounded" />
          <span>Auto-merged</span>
        </div>
        <div className="ml-auto text-gray-400">← Drag to scroll →</div>
      </div>
      
      {/* Column Headers */}
      <div className="flex gap-2 px-4 py-2 bg-gray-100 border-b text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
        <div className="w-12 text-center">V</div>
        <div className="w-24 text-center">Selected</div>
        <div className="flex-1">Sources</div>
      </div>

      {/* Verse List */}
      <div className="flex-1 overflow-auto px-2">
        {verseGroups.map((group, idx) => (
          <RemixVerseRow
            key={getVerseKey(group.verses)}
            verseRange={group.verses}
            selectedItems={selections[getVerseKey(group.verses)] || []}
            versionOptions={getOptionsForRange(group.verses)}
            onAddItem={(item) => handleAddItem(group.verses, item)}
            onRemoveItem={(index) => handleRemoveItem(group.verses, index)}
            expandedCard={expandedCard}
            onExpandCard={setExpandedCard}
            canSplitUp={group.verses.length > 1}
            canMergeDown={idx < verseGroups.length - 1}
            onSplit={() => handleSplit(idx)}
            onMerge={() => handleMerge(idx)}
            isAutoMerged={group.isAuto && !group.wasSplit}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="bg-white border-t p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-gray-600">
            <span className="font-bold text-purple-600">{totalSelected}</span> items in{' '}
            <span className="font-bold text-purple-600">{filledSlots}</span> slots
          </span>
        </div>
        <button
          onClick={() => onSave(remixName, selections, verseGroups)}
          disabled={totalSelected === 0 || !remixName}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:opacity-90 transition-opacity shadow-lg"
        >
          Save Remix
        </button>
      </div>
    </div>
  );
};

// New Version View (Simple placeholder)
const NewVersionView = ({ chapter, onBack, onSave }) => {
  const [versionName, setVersionName] = useState('');

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-blue-500 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl active:bg-white/20">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold">New Version</h2>
          <p className="text-xs text-blue-100">Chapter {chapter.number}</p>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Version Name</label>
          <input
            type="text"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="Enter version name..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 text-center py-8">
            Recording interface would go here.<br />
            Add assets, import audio, etc.
          </p>
        </div>
      </div>

      <div className="p-4 bg-white border-t">
        <button
          onClick={() => onSave(versionName)}
          disabled={!versionName}
          className="w-full py-3.5 rounded-2xl bg-blue-500 text-white font-semibold disabled:opacity-50 active:bg-blue-600 transition-colors"
        >
          Create Version
        </button>
      </div>
    </div>
  );
};

// Main App Component
export default function BibleApp() {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState('books');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);

  const handleBookSelect = (book) => {
    setSelectedBook(book);
    setView('chapters');
  };

  const handleVersionTap = (chapter, version) => {
    setSelectedChapter(chapter);
    setSelectedVersion(version);
    setView('assets');
  };

  const handleNewVersion = (chapter) => {
    setSelectedChapter(chapter);
    setView('newVersion');
  };

  const handleRemixFromChapter = (chapter) => {
    setSelectedChapter(chapter);
    setView('remix');
  };

  const handleSaveNewVersion = (name) => {
    if (!name) return;

    const newVersion = {
      id: `new-${Date.now()}`,
      name: name,
      createdAt: new Date().toISOString().split('T')[0],
      color: 'indigo',
      assets: []
    };

    setData(prev => ({
      ...prev,
      books: prev.books.map(book => ({
        ...book,
        chapters: book.chapters.map(ch =>
          ch.id === selectedChapter.id
            ? { ...ch, versions: [newVersion, ...ch.versions] }
            : ch
        )
      }))
    }));

    setSelectedVersion(newVersion);
    setView('assets');
  };

  const handleSaveRemix = (name, selections, verseGroups) => {
    if (!name || Object.keys(selections).length === 0) return;

    const assets = [];
    
    verseGroups.forEach(group => {
      const key = group.verses.join('-');
      const items = selections[key] || [];
      
      if (items.length > 0) {
        const recordings = items.flatMap(item => {
          if (item.type === 'recording') {
            return [item.recording];
          } else {
            return item.asset.recordings;
          }
        });

        assets.push({
          id: `remix-asset-${Date.now()}-${key}`,
          startVerse: group.verses[0],
          endVerse: group.verses[group.verses.length - 1],
          recordings
        });
      }
    });

    const newVersion = {
      id: `remix-${Date.now()}`,
      name: name,
      createdAt: new Date().toISOString().split('T')[0],
      color: 'purple',
      assets
    };

    setData(prev => ({
      ...prev,
      books: prev.books.map(book => ({
        ...book,
        chapters: book.chapters.map(ch =>
          ch.id === selectedChapter.id
            ? { ...ch, versions: [newVersion, ...ch.versions] }
            : ch
        )
      }))
    }));

    const updatedChapter = {
      ...selectedChapter,
      versions: [newVersion, ...selectedChapter.versions]
    };
    setSelectedChapter(updatedChapter);
    setSelectedVersion(newVersion);
    setView('assets');
  };

  // Books View
  if (view === 'books') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Book size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Scripture Studio</h1>
              <p className="text-xs text-gray-500">Select a book to begin</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-3">
            {data.books.map(book => (
              <button
                key={book.id}
                onClick={() => handleBookSelect(book)}
                className="w-full p-4 bg-white rounded-2xl border border-gray-200 shadow-sm active:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <Book size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{book.name}</h3>
                      <p className="text-sm text-gray-500">{book.chapters.length} chapters</p>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-400" size={20} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Chapters View
  if (view === 'chapters') {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
          <button onClick={() => setView('books')} className="p-2 -ml-2 rounded-xl active:bg-gray-100">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-gray-800">{selectedBook.name}</h1>
            <p className="text-xs text-gray-500">Swipe cards to browse versions • Double-tap to open</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {selectedBook.chapters.map(chapter => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              onVersionTap={handleVersionTap}
              onNewVersion={handleNewVersion}
              onRemix={handleRemixFromChapter}
            />
          ))}
        </div>
      </div>
    );
  }

  // Assets View
  if (view === 'assets') {
    return (
      <div className="h-screen">
        <AssetListView
          version={selectedVersion}
          chapter={selectedChapter}
          onBack={() => setView('chapters')}
          onRemix={() => setView('remix')}
        />
      </div>
    );
  }

  // New Version View
  if (view === 'newVersion') {
    return (
      <div className="h-screen">
        <NewVersionView
          chapter={selectedChapter}
          onBack={() => setView('chapters')}
          onSave={handleSaveNewVersion}
        />
      </div>
    );
  }

  // Remix View
  if (view === 'remix') {
    return (
      <div className="h-screen">
        <RemixView
          chapter={selectedChapter}
          versions={selectedChapter.versions}
          onCancel={() => setView('chapters')}
          onSave={handleSaveRemix}
        />
      </div>
    );
  }

  return null;
}