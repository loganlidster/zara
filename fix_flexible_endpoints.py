import re

# Read the file
with open('api-server/flexible-query-endpoints.js', 'r') as f:
    content = f.read()

# Replace all instances of req.db.query with client.query
content = content.replace('await req.db.query', 'await client.query')

# Find all router.get and router.post patterns and add database client
patterns = [
    (r"(router\.(?:get|post)\('[^']+',\s*async\s*\(req,\s*res\)\s*=>\s*\{)\s*try\s*\{",
     r"\1\n    const client = new Client(dbConfig);\n    \n    try {\n      await client.connect();")
]

for pattern, replacement in patterns:
    content = re.sub(pattern, replacement, content)

# Add finally blocks to close connections
content = re.sub(
    r"(\}\s*catch\s*\(error\)\s*\{[^}]+\}\s*)\}\s*\);",
    r"\1} finally {\n      await client.end();\n    }\n  });",
    content
)

# Write back
with open('api-server/flexible-query-endpoints.js', 'w') as f:
    f.write(content)

print("Fixed flexible-query-endpoints.js")