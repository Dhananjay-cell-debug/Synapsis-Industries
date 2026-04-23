import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), "public", "projects");
        await mkdir(uploadsDir, { recursive: true });

        const ext = file.name.split(".").pop() || "bin";
        const filename = `${Date.now()}.${ext}`;
        await writeFile(path.join(uploadsDir, filename), buffer);

        return NextResponse.json({ url: `/projects/${filename}` });
    } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
