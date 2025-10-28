with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'r') as f:
    content = f.read()

# Find the error section and add timing after it
timing_section = '''
           {/* Timing Info */}
           {timing && (
             <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-8">
               <div className="flex items-center justify-between">
                 <div>
                   <strong>Performance:</strong> Query completed in {(timing.total / 1000).toFixed(2)}s
                 </div>
                 <div className="text-sm">
                   Step 1: {timing.step1}ms (filter) | Step 2: {timing.step2}ms (simulate {timing.candidatesEvaluated} combinations)
                 </div>
               </div>
             </div>
           )}
'''

# Insert timing section before Results Table comment
content = content.replace('           {/* Results Table */}', timing_section + '\n           {/* Results Table */}')

with open('frontend-dashboard/app/reports/best-performers/page.tsx', 'w') as f:
    f.write(content)

print("Added timing display section")