-- CreateIndex
CREATE INDEX "posts_isPublic_createdAt_idx" ON "posts"("isPublic", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_type_isPublic_createdAt_idx" ON "posts"("type", "isPublic", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "posts_authorId_createdAt_idx" ON "posts"("authorId", "createdAt" DESC);
