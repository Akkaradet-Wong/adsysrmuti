const fs = require('fs');
const path = require('path');
const targetPath = path.resolve(__dirname, '../src/pages/Chat.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

content = content.replace(
  /\{\/\* Chat Input \*\/\}.*?(?=<button\s+type="submit")/s,
`{/* Chat Input */}
              <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                <form onSubmit={handleSendMessage} className="flex gap-2.5 max-w-5xl mx-auto items-end relative">
                  
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="พิมพ์ข้อความ ส่งลิงก์..."
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[15px] resize-none h-[48px] min-h-[48px] max-h-[120px]"
                  />
                  
                  `
);
fs.writeFileSync(targetPath, content);
console.log('Fixed chat input!');
