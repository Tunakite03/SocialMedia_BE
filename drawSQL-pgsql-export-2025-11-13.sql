CREATE TABLE "users"(
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT NULL,
    "role" INTEGER NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "users" ADD PRIMARY KEY("id");
ALTER TABLE
    "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");
CREATE TABLE "sessions"(
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "user_agent" TEXT NULL,
    "ip_address" TEXT NULL,
    "expires_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL,
        "created_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "sessions" ADD PRIMARY KEY("id");
CREATE INDEX "sessions_user_id_index" ON
    "sessions"("user_id");
ALTER TABLE
    "sessions" ADD CONSTRAINT "sessions_refresh_token_unique" UNIQUE("refresh_token");
CREATE TABLE "follows"(
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "followee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "follows" ADD CONSTRAINT "follows_follower_id_followee_id_unique" UNIQUE("follower_id", "followee_id");
ALTER TABLE
    "follows" ADD PRIMARY KEY("id");
CREATE INDEX "follows_followee_id_index" ON
    "follows"("followee_id");
CREATE TABLE "posts"(
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "media_url" TEXT NULL,
    "media_type" INTEGER NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "posts_author_id_created_at_index" ON
    "posts"("author_id", "created_at");
ALTER TABLE
    "posts" ADD PRIMARY KEY("id");
CREATE TABLE "comments"(
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "comments_post_id_created_at_index" ON
    "comments"("post_id", "created_at");
ALTER TABLE
    "comments" ADD PRIMARY KEY("id");
CREATE TABLE "post_reactions"(
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "post_reactions" ADD CONSTRAINT "post_reactions_post_id_user_id_type_unique" UNIQUE("post_id", "user_id", "type");
ALTER TABLE
    "post_reactions" ADD PRIMARY KEY("id");
CREATE INDEX "post_reactions_user_id_index" ON
    "post_reactions"("user_id");
CREATE TABLE "comment_reactions"(
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_user_id_type_unique" UNIQUE("comment_id", "user_id", "type");
ALTER TABLE
    "comment_reactions" ADD PRIMARY KEY("id");
CREATE INDEX "comment_reactions_user_id_index" ON
    "comment_reactions"("user_id");
CREATE TABLE "conversations"(
    "id" TEXT NOT NULL,
    "type" INTEGER NOT NULL DEFAULT 'DIRECT',
    "title" TEXT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(0)
    WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "conversations" ADD PRIMARY KEY("id");
CREATE TABLE "conversation_members"(
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NULL,
    "joined_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_user_id_unique" UNIQUE("conversation_id", "user_id");
ALTER TABLE
    "conversation_members" ADD PRIMARY KEY("id");
CREATE INDEX "conversation_members_user_id_index" ON
    "conversation_members"("user_id");
CREATE TABLE "messages"(
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "messages_conversation_id_created_at_index" ON
    "messages"("conversation_id", "created_at");
ALTER TABLE
    "messages" ADD PRIMARY KEY("id");
CREATE INDEX "messages_from_id_index" ON
    "messages"("from_id");
CREATE TABLE "message_attachments"(
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "size" INTEGER NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "message_attachments" ADD PRIMARY KEY("id");
CREATE TABLE "message_reactions"(
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE
    "message_reactions" ADD CONSTRAINT "message_reactions_message_id_user_id_type_unique" UNIQUE("message_id", "user_id", "type");
ALTER TABLE
    "message_reactions" ADD PRIMARY KEY("id");
CREATE INDEX "message_reactions_user_id_index" ON
    "message_reactions"("user_id");
CREATE TABLE "calls"(
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ended_at" TIMESTAMP(0)
    WITH
        TIME zone NULL
);
CREATE INDEX "calls_conversation_id_started_at_index" ON
    "calls"("conversation_id", "started_at");
ALTER TABLE
    "calls" ADD PRIMARY KEY("id");
CREATE TABLE "call_participants"(
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "left_at" TIMESTAMP(0)
    WITH
        TIME zone NULL
);
ALTER TABLE
    "call_participants" ADD CONSTRAINT "call_participants_call_id_user_id_unique" UNIQUE("call_id", "user_id");
ALTER TABLE
    "call_participants" ADD PRIMARY KEY("id");
CREATE INDEX "call_participants_user_id_index" ON
    "call_participants"("user_id");
CREATE TABLE "call_transcripts"(
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NULL,
    "created_at" TIMESTAMP(0) WITH
        TIME zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "call_transcripts_call_id_created_at_index" ON
    "call_transcripts"("call_id", "created_at");
ALTER TABLE
    "call_transcripts" ADD PRIMARY KEY("id");
ALTER TABLE
    "calls" ADD CONSTRAINT "calls_conversation_id_foreign" FOREIGN KEY("conversation_id") REFERENCES "conversations"("id");
ALTER TABLE
    "follows" ADD CONSTRAINT "follows_followee_id_foreign" FOREIGN KEY("followee_id") REFERENCES "users"("id");
ALTER TABLE
    "messages" ADD CONSTRAINT "messages_from_id_foreign" FOREIGN KEY("from_id") REFERENCES "users"("id");
ALTER TABLE
    "conversation_members" ADD CONSTRAINT "conversation_members_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "comments" ADD CONSTRAINT "comments_author_id_foreign" FOREIGN KEY("author_id") REFERENCES "users"("id");
ALTER TABLE
    "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_foreign" FOREIGN KEY("comment_id") REFERENCES "comments"("id");
ALTER TABLE
    "posts" ADD CONSTRAINT "posts_author_id_foreign" FOREIGN KEY("author_id") REFERENCES "users"("id");
ALTER TABLE
    "message_attachments" ADD CONSTRAINT "message_attachments_message_id_foreign" FOREIGN KEY("message_id") REFERENCES "messages"("id");
ALTER TABLE
    "follows" ADD CONSTRAINT "follows_follower_id_foreign" FOREIGN KEY("follower_id") REFERENCES "users"("id");
ALTER TABLE
    "comments" ADD CONSTRAINT "comments_post_id_foreign" FOREIGN KEY("post_id") REFERENCES "posts"("id");
ALTER TABLE
    "call_participants" ADD CONSTRAINT "call_participants_call_id_foreign" FOREIGN KEY("call_id") REFERENCES "calls"("id");
ALTER TABLE
    "post_reactions" ADD CONSTRAINT "post_reactions_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "message_reactions" ADD CONSTRAINT "message_reactions_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "sessions" ADD CONSTRAINT "sessions_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_foreign" FOREIGN KEY("conversation_id") REFERENCES "conversations"("id");
ALTER TABLE
    "message_reactions" ADD CONSTRAINT "message_reactions_message_id_foreign" FOREIGN KEY("message_id") REFERENCES "messages"("id");
ALTER TABLE
    "call_participants" ADD CONSTRAINT "call_participants_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "messages" ADD CONSTRAINT "messages_conversation_id_foreign" FOREIGN KEY("conversation_id") REFERENCES "conversations"("id");
ALTER TABLE
    "post_reactions" ADD CONSTRAINT "post_reactions_post_id_foreign" FOREIGN KEY("post_id") REFERENCES "posts"("id");
ALTER TABLE
    "call_transcripts" ADD CONSTRAINT "call_transcripts_call_id_foreign" FOREIGN KEY("call_id") REFERENCES "calls"("id");