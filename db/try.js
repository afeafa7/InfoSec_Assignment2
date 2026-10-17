import * as q from './db.js';

console.log('User 1:', q.getUserById(1));
console.log('Course taught by user 3:', q.getCourseForLecturer(3));
console.log('Is user 1 enrolled in course 1?', q.isEnrolled(1, 1));
console.log('Is user 3 (the lecturer) enrolled in course 1?', q.isEnrolled(1, 3));
console.log('Grades for user 1:', q.getGradesForStudent(1));
console.log('Roster for course 1:', q.getRoster(1));