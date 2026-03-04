#!/bin/bash
# Apply "as string" to req.params/req.query
sed -i 's/const { keyId } = req.params;/const keyId = req.params.keyId as string;/' apps/server/src/routes/keys.ts
sed -i 's/const { noteId } = req.params;/const noteId = req.params.noteId as string;/' apps/server/src/routes/notes.ts
sed -i 's/const { todoId } = req.params;/const todoId = req.params.todoId as string;/' apps/server/src/routes/notes.ts
sed -i 's/const { roomId } = req.params;/const roomId = req.params.roomId as string;/' apps/server/src/routes/rooms.ts

# Cast roomId in notes query
sed -i "s/where: { roomId }/where: { roomId: roomId as string }/" apps/server/src/routes/notes.ts

# Fix note.room and room.host etc
sed -i 's/note.room/(note as any).room/g' apps/server/src/routes/notes.ts
sed -i 's/note.todos/(note as any).todos/g' apps/server/src/routes/notes.ts
sed -i 's/m: any/m: any/' apps/server/src/routes/notes.ts # just in case
sed -i 's/(m)/(m: any)/' apps/server/src/routes/notes.ts
sed -i 's/room.members/(room as any).members/g' apps/server/src/routes/rooms.ts
sed -i 's/room.host/(room as any).host/g' apps/server/src/routes/rooms.ts
sed -i 's/m.user/(m as any).user/g' apps/server/src/routes/rooms.ts
sed -i 's/m.role/(m as any).role/g' apps/server/src/routes/rooms.ts
sed -i 's/threads._count/(threads as any)._count/g' apps/server/src/routes/rooms.ts

# Fix maxOrder in notes.ts
sed -i 's/order: (maxOrder._max.order ?? -1) + 1/order: (maxOrder?._max?.order ?? -1) + 1/' apps/server/src/routes/notes.ts

# Fix gateway.ts
sed -i 's/const data = JSON.parse(line.replace(/const data: any = JSON.parse(line.replace(/' apps/server/src/services/llm/gateway.ts

# Fix handlers.ts
sed -i 's/createdAt: member.user.createdAt,/createdAt: member.user.createdAt.toISOString() as any,/' apps/server/src/socket/handlers.ts

# Fix dag.ts
sed -i 's/const node = await prisma.messageNode/const node: any = await prisma.messageNode/' apps/server/src/services/dag.ts

