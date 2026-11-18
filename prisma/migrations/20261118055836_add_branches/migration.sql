/*
  Warnings:

  - You are about to drop the column `status` on the `HomeworkResult` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[branch_id,name]` on the table `Course` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,name]` on the table `Group` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,name]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,phone]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,email]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,phone]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,email]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[branch_id,email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lesson_id` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `group_id` to the `HomeworkResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `homework_id` to the `HomeworkResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branch_id` to the `Teacher` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "courseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "TeacherGroupStatus" AS ENUM ('active', 'inactive', 'planned', 'completed');

-- DropIndex
DROP INDEX "Course_name_key";

-- DropIndex
DROP INDEX "Group_name_key";

-- DropIndex
DROP INDEX "Room_name_key";

-- DropIndex
DROP INDEX "Student_email_key";

-- DropIndex
DROP INDEX "Student_phone_key";

-- DropIndex
DROP INDEX "Teacher_email_key";

-- DropIndex
DROP INDEX "Teacher_phone_key";

-- DropIndex
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_phone_key";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "lesson_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "GroupTeacher" ADD COLUMN     "status" "TeacherGroupStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "HomeworkResult" DROP COLUMN "status",
ADD COLUMN     "group_id" INTEGER NOT NULL,
ADD COLUMN     "homework_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "branch_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branch_id" INTEGER;

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "logo" TEXT,
    "status" "Status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonVideo" (
    "id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "originalname" TEXT NOT NULL,
    "video_url" TEXT NOT NULL,
    "size_mb" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_slug_key" ON "Branch"("slug");

-- CreateIndex
CREATE INDEX "Course_branch_id_idx" ON "Course"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Course_branch_id_name_key" ON "Course"("branch_id", "name");

-- CreateIndex
CREATE INDEX "Group_branch_id_idx" ON "Group"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Group_branch_id_name_key" ON "Group"("branch_id", "name");

-- CreateIndex
CREATE INDEX "Room_branch_id_idx" ON "Room"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Room_branch_id_name_key" ON "Room"("branch_id", "name");

-- CreateIndex
CREATE INDEX "Student_branch_id_idx" ON "Student"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Student_branch_id_phone_key" ON "Student"("branch_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Student_branch_id_email_key" ON "Student"("branch_id", "email");

-- CreateIndex
CREATE INDEX "Teacher_branch_id_idx" ON "Teacher"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_branch_id_phone_key" ON "Teacher"("branch_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_branch_id_email_key" ON "Teacher"("branch_id", "email");

-- CreateIndex
CREATE INDEX "User_branch_id_idx" ON "User"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_branch_id_phone_key" ON "User"("branch_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_branch_id_email_key" ON "User"("branch_id", "email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkResult" ADD CONSTRAINT "HomeworkResult_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkResult" ADD CONSTRAINT "HomeworkResult_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonVideo" ADD CONSTRAINT "LessonVideo_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
