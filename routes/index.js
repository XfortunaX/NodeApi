var express = require('express');
var router = express.Router();

var db = require('../queries');

router.post('/api/user/:nickname/create', db.createUser);

router.get('/api/user/:nickname/profile', db.getUser);

router.post('/api/user/:nickname/profile', db.updateUser);

router.post('/api/forum/create', db.createForum);

router.get('/api/forum/:slug/details', db.getForum);

router.post('/api/forum/:slug/create', db.createThread);

router.get('/api/forum/:slug/threads', db.getThreads);

router.post('/api/thread/:slug_or_id/create', db.createOneThread);

router.post('/api/thread/:slug_or_id/vote', db.createVote);

router.get('/api/thread/:slug_or_id/details', db.getThread);

router.post('/api/thread/:slug_or_id/details', db.updateThread);

router.get('/api/thread/:slug_or_id/posts', db.getPosts);

router.get('/api/forum/:slug/users', db.getUsers);

router.get('/api/post/:id/details', db.getPost);

router.post('/api/post/:id/details', db.updatePost);

router.get('/api/service/status', db.getStatus);

router.post('/api/service/clear', db.serviceClear);

module.exports = router;
