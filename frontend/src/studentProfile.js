let currentStudent = null;

export function getCurrentStudent() {
  return currentStudent;
}

export function setCurrentStudent(student) {
  currentStudent = student;
}

export function clearCurrentStudent() {
  currentStudent = null;
}
