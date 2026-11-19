-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'SUPERVISOR', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('TEACHER', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "LessonKind" AS ENUM ('READING', 'LISTENING', 'LEXICAL', 'GRAMMAR', 'SPELLING', 'HANDWRITING', 'WRITING', 'SPEAKING', 'REVIEW');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'DONE', 'POSTPONED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('LESSON', 'HOMEWORK', 'QUIZ', 'MIDTERM', 'FINAL', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('ACADEMIC', 'GUARDIAN_CONTACT', 'REMEDIAL', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "ComponentKind" AS ENUM ('PARTICIPATION', 'HOMEWORK', 'PERFORMANCE', 'QUIZ', 'MIDTERM', 'FINAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('NORMAL', 'EXCUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('MANUAL', 'AUTO', 'GAME');

-- CreateEnum
CREATE TYPE "QType" AS ENUM ('MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING', 'CLASSIFY', 'ORDER_WORDS', 'EXTRACT', 'TRANSFORM', 'DICTATION', 'OPEN', 'READING_PASSAGE');

-- CreateEnum
CREATE TYPE "QStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('WORKSHEET', 'QUIZ', 'MIDTERM', 'FINAL', 'GAME_SET');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId","permission")
);

-- CreateTable
CREATE TABLE "ClassStaff" (
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,

    CONSTRAINT "ClassStaff_pkey" PRIMARY KEY ("userId","classId")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Week" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 4,
    "section" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "leaderboardVisible" BOOLEAN NOT NULL DEFAULT true,
    "disabledGames" TEXT[],

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "weekId" TEXT,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "LessonKind" NOT NULL,
    "periods" INTEGER NOT NULL DEFAULT 1,
    "objectives" TEXT[],
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSkill" (
    "lessonId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "LessonSkill_pkey" PRIMARY KEY ("lessonId","skillId")
);

-- CreateTable
CREATE TABLE "VocabItem" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT,
    "antonym" TEXT,
    "plural" TEXT,
    "dual" TEXT,
    "tags" TEXT[],
    "audioUrl" TEXT,

    CONSTRAINT "VocabItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT,
    "assessmentId" TEXT,
    "note" TEXT,
    "rescheduledFrom" TIMESTAMP(3),
    "createdBy" TEXT,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nationalIdEnc" TEXT,
    "nationalIdLast4" TEXT,
    "nationalIdHash" TEXT,
    "birthDate" DATE,
    "guardianName" TEXT,
    "guardianPhoneEnc" TEXT,
    "healthNotesEnc" TEXT,
    "avatar" TEXT NOT NULL DEFAULT '🌸',
    "pictureCodeHash" TEXT,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "positive" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "BehaviorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "NoteKind" NOT NULL,
    "body" TEXT NOT NULL,
    "visibleToSupervisor" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFile" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentScheme" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "gradeScale" JSONB NOT NULL,
    "absentAsZero" BOOLEAN NOT NULL DEFAULT true,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeComponent" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "kind" "ComponentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "SchemeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeItem" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "maxScore" DECIMAL(6,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "assessmentId" TEXT,
    "rubricId" TEXT,
    "skillIds" TEXT[],
    "createdBy" TEXT,

    CONSTRAINT "GradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeLock" (
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT NOT NULL,

    CONSTRAINT "GradeLock_pkey" PRIMARY KEY ("classId","termId")
);

-- CreateTable
CREATE TABLE "GradeEntry" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DECIMAL(6,2),
    "status" "EntryStatus" NOT NULL DEFAULT 'NORMAL',
    "source" "EntrySource" NOT NULL DEFAULT 'MANUAL',
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "lessonId" TEXT,
    "skillId" TEXT,
    "type" "QType" NOT NULL,
    "stem" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "answerKey" JSONB NOT NULL,
    "points" DECIMAL(5,2) NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "bloom" TEXT,
    "mediaUrl" TEXT,
    "parentId" TEXT,
    "status" "QStatus" NOT NULL DEFAULT 'APPROVED',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "blueprint" JSONB,
    "durationMin" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "instructions" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPublication" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "gradeItemId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentVersion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "questionIds" TEXT[],
    "shuffleSeed" INTEGER NOT NULL,
    "pdfKey" TEXT,
    "answerPdfKey" TEXT,

    CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT,
    "manualScores" JSONB,
    "versionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "autoScore" DECIMAL(6,2),
    "finalScore" DECIMAL(6,2),
    "perSkill" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedBy" TEXT,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "skillCodes" TEXT[],
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAssignment" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "lessonIds" TEXT[],
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3),
    "countsToGrades" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gameCode" TEXT NOT NULL,
    "skillCode" TEXT NOT NULL,
    "itemRef" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "ms" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "rule" JSONB NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentBadge" (
    "studentId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBadge_pkey" PRIMARY KEY ("studentId","badgeId")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MANUAL',
    "ref" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "verifyCode" TEXT NOT NULL,
    "pdfKey" TEXT,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorComment" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Term_yearId_number_key" ON "Term"("yearId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Week_termId_number_key" ON "Week"("termId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_joinCode_key" ON "SchoolClass"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_schoolId_grade_section_key" ON "SchoolClass"("schoolId", "grade", "section");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");

-- CreateIndex
CREATE INDEX "CalendarEvent_classId_date_idx" ON "CalendarEvent"("classId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Student_nationalIdHash_key" ON "Student"("nationalIdHash");

-- CreateIndex
CREATE INDEX "Student_classId_idx" ON "Student"("classId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_period_key" ON "Attendance"("studentId", "date", "period");

-- CreateIndex
CREATE INDEX "StudentFile_studentId_idx" ON "StudentFile"("studentId");

-- CreateIndex
CREATE INDEX "GradeItem_classId_termId_idx" ON "GradeItem"("classId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeEntry_itemId_studentId_key" ON "GradeEntry"("itemId", "studentId");

-- CreateIndex
CREATE INDEX "Question_skillId_type_idx" ON "Question"("skillId", "type");

-- CreateIndex
CREATE INDEX "Question_parentId_idx" ON "Question"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPublication_assessmentId_classId_key" ON "AssessmentPublication"("assessmentId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_publicationId_studentId_key" ON "Attempt"("publicationId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GameAttempt_clientId_key" ON "GameAttempt"("clientId");

-- CreateIndex
CREATE INDEX "GameAttempt_studentId_playedAt_idx" ON "GameAttempt"("studentId", "playedAt");

-- CreateIndex
CREATE INDEX "GameAttempt_skillCode_idx" ON "GameAttempt"("skillCode");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_verifyCode_key" ON "Certificate"("verifyCode");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassStaff" ADD CONSTRAINT "ClassStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassStaff" ADD CONSTRAINT "ClassStaff_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Week" ADD CONSTRAINT "Week_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSkill" ADD CONSTRAINT "LessonSkill_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSkill" ADD CONSTRAINT "LessonSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabItem" ADD CONSTRAINT "VocabItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorRecord" ADD CONSTRAINT "BehaviorRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNote" ADD CONSTRAINT "StudentNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFile" ADD CONSTRAINT "StudentFile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentScheme" ADD CONSTRAINT "AssessmentScheme_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeComponent" ADD CONSTRAINT "SchemeComponent_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "AssessmentScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SchemeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeItem" ADD CONSTRAINT "GradeItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEntry" ADD CONSTRAINT "GradeEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GradeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeEntry" ADD CONSTRAINT "GradeEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPublication" ADD CONSTRAINT "AssessmentPublication_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "AssessmentPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAttempt" ADD CONSTRAINT "GameAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

