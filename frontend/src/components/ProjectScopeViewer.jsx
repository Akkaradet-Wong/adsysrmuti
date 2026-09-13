import React from 'react';

export const ProjectScopeViewer = ({ scopeString }) => {
  if (!scopeString) return <span className="text-slate-400 italic">ไม่ได้ระบุขอบเขต</span>;

  let parsed = null;
  try {
    const data = JSON.parse(scopeString);
    if (Array.isArray(data) && data.length > 0) {
      parsed = data;
    }
  } catch {
    // Not JSON, fall back to string rendering
  }

  if (parsed) {
    return (
      <div className="space-y-3 mt-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
        {parsed.map((mainScope, idx) => (
          <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50 shadow-sm">
            <div className="font-bold text-[13px] text-slate-800 mb-2 border-b border-slate-200 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 break-words">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0"></span>
                {mainScope.mainTitle}
              </div>
              {mainScope.score && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-extrabold shrink-0">
                  คะแนน: {mainScope.score}
                </span>
              )}
            </div>
            <div className="space-y-1.5 pl-3 border-l-2 border-slate-200 ml-0.5">
              {mainScope.subScopes?.map((sub, sIdx) => (
                <div key={sIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 p-1.5 bg-white rounded-lg border border-slate-100 shadow-sm">
                  <span className="text-[12px] text-slate-600 font-semibold break-words flex-1">
                    • {sub.title}
                  </span>
                  {sub.score && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 shrink-0 self-start sm:self-auto">
                      คะแนน: {sub.score}
                    </span>
                  )}
                </div>
              ))}
              {!mainScope.subScopes?.length && (
                <span className="text-[11px] text-slate-400 font-medium italic block py-1">ไม่มีขอบเขตย่อย</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap break-words">
      {scopeString}
    </div>
  );
};

export default ProjectScopeViewer;
