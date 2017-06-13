/**
 * Created by sergey on 12.03.17.
 */

var promise = require('bluebird');

var options = {
  promiseLib: promise
};

var pgp = require('pg-promise')(options);
var connectionString = "postgres://docker:docker@localhost:5432/docker";
var db = pgp(connectionString);


function isEmpty(obj) {
  for (let key in obj) {
    return false;
  }
  return true;
}

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function updateUserQuery(fullname, email, about) {
  let query = 'update users set (';
  if(!isEmpty(fullname)) {
    query += 'fullname';
    if(!isEmpty(about)) {
      query += ', about';
    }
    if(!isEmpty(email)) {
      query += ', email';
    }
  } else if (!isEmpty(about)) {
    query += 'about';
    if(!isEmpty(email)) {
      query += ', email';
    }
  } else if (!isEmpty(email)) {
    query += 'email';
  }
  query += ') = (';
  if(!isEmpty(fullname)) {
    query += '\'' + fullname + '\'';
    if(!isEmpty(about)) {
      query += ',\'' + about + '\'';
    }
    if(!isEmpty(email)) {
      query += ',\'' + email + '\'';
    }
  } else if (!isEmpty(about)) {
    query += '\'' + about + '\'';
    if(!isEmpty(email)) {
      query += ',\'' + email + '\'';
    }
  } else if (!isEmpty(email)) {
    query += '\'' + email + '\'';
  }
  query += ') where nickname = $1 returning *';
  return query;
}

function insertThread(slug, created) {
  let query = 'insert into threads (author, forum, message, title';
  if(!isEmpty(slug)) {
    query += ', slug';
  }
  if(!isEmpty(created)) {
    query += ', created';
  }
  query += ') values ($1, $2, $3, $4';
  if(!isEmpty(slug)) {
    query += ',\'' + slug + '\'';
  }
  if(!isEmpty(created)) {
    query += ',\'' + created + '\'';
  }
  query += ') returning id;';
  return query;
}

function createUser(req, res, next) {
  let nickname = req.params.nickname;
  let fullname = req.body.fullname;
  let about = req.body.about;
  let email = req.body.email;

  db.many('select * from users where upper(nickname) = $1 or email = $2', [nickname.toUpperCase(), email])
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(409).send(d);
    })
    .catch( err => {
      return db.one('insert into users (nickname, fullname, about, email) values (\'' + nickname + '\',\''
        + fullname + '\',\'' + about +'\',\'' + email + '\') returning *');
    })
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(201).send(d);
    });
}

function getUser(req, res, next) {
  let nickname = req.params.nickname;

  db.one('select * from users where upper(nickname) = $1', nickname.toUpperCase())
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(200).send(d);
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function updateUser(req, res, next) {
  let nickname = req.params.nickname;
  let fullname = req.body.fullname;
  let about = req.body.about;
  let email = req.body.email;
  let nicknameUser = '';

  db.one('select * from users where upper(nickname) = $1', nickname.toUpperCase())
    .catch( err => {
      res.status(404).send(err);
    })
    .then( data => {
      nicknameUser = data.nickname;
      if (isEmpty(email) && isEmpty(about) && isEmpty(fullname)) {
        let d = JSON.stringify(data);
        d = JSON.parse(d);
        res.status(200).send(d);
      } else if (!isEmpty(email)) {
        db.none('select * from users where email = $1 and nickname != $2', [email, nicknameUser])
          .then( () => {
            email = '';
            db.one(updateUserQuery(fullname, email, about), nicknameUser)
              .then(data => {
                let d = JSON.stringify(data);
                d = JSON.parse(d);
                res.status(201).send(d);
              });
          })
          .catch( () => {
            res.status(409).send();
          })
      }
      db.one(updateUserQuery(fullname, email, about), nicknameUser)
        .then(data => {
          let d = JSON.stringify(data);
          d = JSON.parse(d);
          res.status(200).send(d);
        });
    });
}

function createForum(req, res, next) {
  let slug = req.body.slug;
  let title = req.body.title;
  let username = req.body.user;

  db.one('select nickname from users where upper(nickname) = $1', username.toUpperCase())
    .catch( () => {
      res.status(404).send();
    })
    .then( data => {
      username = data.nickname;
      return db.one('select username as \"user\", slug, posts, threads,' +
        ' title from forums where username = $1 and slug = $2', [username, slug])
    })
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(409).send(d);
    })
    .catch( () => {
      db.tx(t => {
        let q1 = t.none('insert into forums (title, username, slug) ' +
          'values (\'' + title + '\',\'' + username + '\',\'' + slug + '\')');
        let q2 = t.one('select username as \"user\", slug, posts, threads,' +
          ' title from forums where username = $1 and slug = $2', [username, slug]);
        return t.batch([q1, q2]);
      })
        .then( data => {
          let d = JSON.stringify(data[1]);
          d = JSON.parse(d);
          res.status(201).send(d);
        })
    })
}

function getForum(req, res, next) {
  let slug = req.params.slug;

  db.one('select title, username as \"user\", slug, posts, threads from forums where slug = $1', slug)
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(200).send(d);
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function createThread(req, res, next) {
  let author = req.body.author;
  let created = req.body.created;
  let message = req.body.message;
  let title = req.body.title;
  let slugThread = req.body.slug;
  let slug = req.params.slug;
  let forumId = 0;
  let forumTitle = '';

  db.tx( t => {
    let q1 = t.one('select id from forums where slug = $1', slug);
    let q2 = t.one('select nickname from users where upper(nickname) = $1', author.toUpperCase());
    return t.batch([q1, q2]);
  })
    .catch( err => {
      res.status(404).send(err);
    })
    .then( data => {
      forumId = data[0].id;
      author = data[1].nickname;
      return db.one('select threads.id, threads.author, forums.slug as \"forum\", threads.message, threads.title, threads.slug, ' +
        'threads.created from threads inner join forums on threads.forum = forums.id where threads.slug = $1', slugThread);
    })
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(409).send(d);
    })
    .catch( () => {
      db.tx(t => {
        let q1 = t.one(insertThread(slugThread, created), [author, forumId, message, title]);
        let q2 = t.none('update forums set (threads) = (threads + ' + 1 + ') where id = $1', forumId);
        return t.batch([q1, q2]);
      })
        .then( data => {
          return db.one('select threads.id, threads.author, forums.slug as \"forum\", threads.message, threads.title, threads.slug, ' +
            'threads.created from threads inner join forums on threads.forum = forums.id where threads.id = $1', data[0].id);
        })
        .then( data => {
          let d = JSON.stringify(data);
          d = JSON.parse(d);
          res.status(201).send(d);
        })
    });
}

function getThreads(req, res, next) {
  let slug = req.params.slug;
  let desc = 'asc';
  if(req.query.desc === 'true') {
    desc = 'desc';
  }
  let limit = req.query.limit;
  let since = req.query.since;

  db.one('select * from forums where slug = $1', slug)
    .then( data => {
      let query = 'select threads.slug, threads.id, threads.title, threads.message, threads.author, ' +
        ' threads.created, forums.slug as forum, threads.votes from threads ' +
        ' inner join forums ON (forums.id = threads.forum) where threads.forum = $1';
      if(!isEmpty(since)) {
        if(desc === 'desc') {
          query += ' and threads.created <= $2';
        } else {
          query += ' and threads.created >= $2';
        }
      }
      query +=' order by threads.created ' + desc;
      if(!isEmpty(limit)) {
        query += ' limit ' + limit;
      }
      if(isEmpty(since)) {
        return db.any(query, data.id)
      } else {
        return db.any(query, [data.id, since])
      }
    })
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(200).send(d);
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function createOneThread(req, res, next) {
  let slug = req.params.slug_or_id;
  let posts = req.body;
  let forumSlug = 0;
  let threadId = 0;
  let forumId = 0;
  let query = "threads.id";
  if(!isNumeric(slug)) {
    query = "threads.slug";
  }

  for (let j = 0; j < posts.length; j++) {
    if(!('parent' in posts[j])) {
      posts[j].parent = 0;
      posts[j].path = [];
    }
  }

  db.one('select threads.id, forums.slug, forums.id as \"forumId\" from threads inner join forums on threads.forum = forums.id ' +
    ' where ' + query + ' = $1', slug)
    .catch( err => {
      res.status(404).send(err);
    })
    .then( data => {
      forumSlug = data.slug;
      threadId = data.id;
      forumId = data.forumId;
      return db.tx( t => {
        let queries = [];
        for (let i = 0; i < posts.length; i += 1) {
          if (posts[i].parent !== 0) {
            let q1 = t.one('select path, id from posts where id = ' + posts[i].parent + ' and thread = ' + threadId);
            queries.push(q1);
          }
        }
        return t.batch(queries);
      })
    })
    .catch( err => {
      res.status(409).send(err);
    })
    .then( data => {
      let k = 0;
      for (let i = 0; i < posts.length; i += 1) {
        if (posts[i].parent !== 0) {
          posts[i].path = data[k].path;
          k += 1;
        }
      }
      return db.tx(t => {
        let query = ' INSERT INTO posts (id, author, message, parent, thread, forum, path) VALUES';
        for (let i = 0; i < posts.length; i += 1) {
          query += ' ((SELECT nextval(\'posts_id_seq\')),\'' + posts[i].author + '\',\'' + posts[i].message + '\',' +
            posts[i].parent + ',\'' + threadId + '\',\'' + forumSlug + '\',' + ' array_append(ARRAY[';
          if (posts[i].path.length > 0) {
            query += posts[i].path[0];
          }
          for (let j = 1; j < posts[i].path.length; j += 1) {
            query += ',' + posts[i].path[j];
          }
          query += ']::bigint[], (SELECT currval(\'posts_id_seq\'))))';
          if (i < posts.length - 1) {
            query += ',';
          }
        }
        query += ' returning id, created, author, parent, forum, message, thread ';
        let q1 = db.any(query);
        // let queries = posts.map(l => {
        //   let query = ' INSERT INTO posts (author, message, parent, thread, forum, path) ' +
        //     'VALUES (\'' + l.author + '\',\'' + l.message + '\',' +
        //     + l.parent + ',\'' + threadId + '\',\'' + forumSlug + '\',' +
        //     ' array_append(ARRAY[';
        //   if(l.path.length > 0) {
        //     query += l.path[0];
        //   }
        //   for (let i = 1; i < l.path.length; i += 1) {
        //     query += ',' + l.path[i];
        //   }
        //   query += ']::bigint[], (SELECT currval(\'posts_id_seq\')))) returning id, created, author, parent,' +
        //     ' forum, message, thread ;';
        //   return t.one(query);
        // });
        let q3 = db.none('update forums set (posts) = (posts + ' + posts.length + ') where forums.slug = $1', forumSlug);
        return t.batch([q1, q3]);
      })
    })
    .then( data => {
      data.pop();
      let d = JSON.stringify(data[0]);
      d = JSON.parse(d);
      res.status(201).send(d);
    })
    .catch( err => {
      res.status(404).send(err);
    });

}

function createVote(req, res, next) {
  let slug = req.params.slug_or_id;
  let slug_or_id = 'threads.id';
  if(!isNumeric(slug)) {
    slug_or_id = 'threads.slug';
  }
  let nickname = req.body.nickname;
  let voice = req.body.voice;
  let deltaVoice = 0;
  let threadId = 0;
  let thread;

  db.one('select forums.slug as forum, threads.author, threads.created, threads.id,' +
    ' threads.message, threads.slug, threads.title, threads.votes from threads inner join forums' +
    ' on (threads.forum=forums.id) where ' + slug_or_id + ' = $1 ', slug)
    .catch( err => {
      res.status(404).send();
    })
    .then( data => {
      thread = data;
      threadId = data.id;
      return db.one('select id, voice from votes where username = $1 and thread = $2', [nickname, threadId])
    })
    .then( data => {
      deltaVoice = -(data.voice - voice);
      db.tx(t => {
        let q1 = t.none('update votes set (voice) = (' + voice + ') where id = $1', data.id);
        let q2 = t.none('update threads set (votes) = (votes + ' + deltaVoice + ') where id = $1', threadId);
        return t.batch([q1, q2]);
      })
        .then( data => {
          let d = JSON.stringify(thread);
          d = JSON.parse(d);
          d.votes += deltaVoice;
          res.status(200).send(d);
        })
    })
    .catch( err => {
      db.tx(t => {
        let q1 = t.none('insert into votes (username, voice, thread) values ($1, $2, $3)', [nickname, voice, threadId]);
        let q2 = t.none('update threads set (votes) = (votes + ' + voice + ') where id = $1', threadId);
        return t.batch([q1, q2]);
      })
        .then( data => {
          let d = JSON.stringify(thread);
          d = JSON.parse(d);
          d.votes += voice;
          res.status(200).send(d);
        })
        .catch ( err => {
          res.status(404).send(err);
        });
    });

  // db.one('select id from threads where ' + slug_or_id + ' = $1', slug)
  //   .catch( err => {
  //     res.status(404).send();
  //   })
  //   .then( data => {
  //     threadId = data.id;
  //     return db.one('select voice, id from votes where username = $1 and thread = $2', [nickname, threadId])
  //   })
  //   .then( data => {
  //     deltaVoice = -(data.voice - voice);
  //     db.tx(t => {
  //       let q1 = t.none('update votes set (voice) = (' + voice + ') where id = $1', data.id);
  //       let q2 = t.none('update threads set (votes) = (votes + ' + deltaVoice + ') where id = $1', threadId);
  //       let q3 = t.one('select forums.slug as forum, threads.author, threads.created, threads.id,' +
  //         ' threads.message, threads.slug, threads.title, threads.votes from threads inner join forums' +
  //         ' on (threads.forum=forums.id) where threads.id = $1', threadId);
  //       return t.batch([q1, q2, q3]);
  //     })
  //       .then( data => {
  //         let d = JSON.stringify(data[2]);
  //         d = JSON.parse(d);
  //         res.status(200).send(d);
  //       })
  //   })
  //   .catch( err => {
  //     db.tx(t => {
  //       let q1 = t.none('insert into votes (username, voice, thread) values ($1, $2, $3)', [nickname, voice, threadId]);
  //       let q2 = t.none('update threads set (votes) = (votes + ' + voice + ') where id = $1', threadId);
  //       let q3 = t.one('select forums.slug as forum, threads.author, threads.created, threads.id,' +
  //         ' threads.message, threads.slug, threads.title, threads.votes from threads inner join forums' +
  //         ' on (threads.forum=forums.id) where threads.id = $1', threadId);
  //       return t.batch([q1, q2, q3]);
  //     })
  //       .then( data => {
  //         let d = JSON.stringify(data[2]);
  //         d = JSON.parse(d);
  //         res.status(200).send(d);
  //       })
  //       .catch ( err => {
  //         res.status(404).send(err);
  //       });
  //   })
}

function getThread(req, res, next) {
  let slug = req.params.slug_or_id;
  let query = "threads.id";
  if(!isNumeric(slug)) {
    query = "threads.slug";
  }

  db.one('select forums.slug as forum, threads.author, threads.created, threads.title, threads.slug, ' +
    ' threads.message, threads.id, threads.votes' +
    ' from threads inner join forums on (threads.forum = forums.id) where ' + query + ' = $1', slug)
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(200).send(d);
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function updateThread(req, res, next) {
  let slug = req.params.slug_or_id;
  let query = "threads.id";
  if(!isNumeric(slug)) {
    query = "threads.slug";
  }

  db.one('select * from threads where ' + query + ' = $1', slug)
    .then( data => {
      return db.tx( (t) => {
        let q1 = t.one('select forums.slug as forum, threads.author, threads.created, threads.title,' +
          ' threads.slug, threads.message, threads.id from threads inner join forums' +
          ' on (threads.forum=forums.id) where ' + query + ' = $1', slug);
        if(!isEmpty(req.body.title) && !isEmpty(req.body.message)) {
          q1 = t.none('update threads set (title, message) = (\'' + req.body.title + '\',' +
            '\'' + req.body.message + '\') where ' + query + ' = $1', slug);
        } else if (!isEmpty(req.body.title)) {
          q1 = t.none('update threads set (title) = (\'' + req.body.title + '\') where ' + query + ' = $1', slug);
        } else if (!isEmpty(req.body.message)) {
          q1 = t.none('update threads set (message) = (\'' + req.body.message + '\') where ' + query + ' = $1', slug);
        }
        let q2 = t.one('select forums.slug as forum, threads.author, threads.created, threads.title,' +
          ' threads.slug, threads.message, threads.id from threads inner join forums' +
          ' on (threads.forum=forums.id) where ' + query + ' = $1', slug);
        return t.batch([q1, q2]);
      })
    })
    .then( data => {
      let d = JSON.stringify(data[1]);
      d = JSON.parse(d);
      res.status(200).send(d);
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function getPosts(req, res, next) {
  let desc = 'asc';
  if('desc' in req.query && req.query.desc === 'true') {
    desc = 'desc';
  }
  let limit = 0;
  if('limit' in req.query) {
    limit = req.query.limit;
  }
  let marker = 0;
  if('marker' in req.query) {
    marker = parseInt(req.query.marker);
  }
  let sort = 'flat';
  if('sort' in req.query && req.query.desc !== 'flat') {
    sort = req.query.sort;
  }
  let slug = req.params.slug_or_id;
  let str_query = "threads.id";
  if(!isNumeric(slug)) {
    str_query = "threads.slug";
  }
  let query;

  db.one('select * from threads where ' + str_query + ' = $1', slug)
    .then( data => {
      if(sort === 'flat') {
        query = 'SELECT author, created, id, isEdited, message, thread, forum, parent FROM posts WHERE thread = ' + data.id +
          ' ORDER BY created ' + desc + ', id ' + desc + ' LIMIT ' + limit + ' OFFSET ' + marker;
        return db.any(query);
      } else if(sort === 'tree') {
        query = 'SELECT author, created, id, isEdited, message, thread, forum, parent FROM posts WHERE thread = ' + data.id +
          ' ORDER BY path ' + desc + ' LIMIT ' + limit + ' OFFSET ' + marker;
        return db.any(query);
      } else if(sort === 'parent_tree') {
        return db.tx( (t) => {
          let query = 'SELECT author, created, id, isEdited, message, thread, ' +
            'forum, parent FROM posts WHERE path[1] in (SELECT id FROM posts WHERE parent = 0 ' +
            'AND thread = ' + data.id + ' ORDER BY id ' + desc + ' LIMIT ' + limit + ' OFFSET ' + marker + ') ' +
            'and thread = ' + data.id + ' ORDER BY path ' + desc + ', id ' + desc;
          let q1 = db.any(query);
          let q2 = db.any('SELECT id FROM posts WHERE parent = 0 AND thread = ' + data.id + ' ORDER BY id ' + desc + ' LIMIT ' + limit + ' OFFSET ' + marker);
          return t.batch([q1, q2]);
        });
      }
    })
    .then( data => {
      let result = 0;
      if(sort === 'flat' || sort === 'tree') {
        marker += data.length;
        result = data;
      } else {
        result = data[0];
        marker += data[1].length;
      }
      res.status(200)
        .json({
          marker: String(marker),
          posts: result
        });
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function getUsers(req, res, next) {
  const desc = req.query.desc;
  const limit = req.query.limit;
  const since = req.query.since;
  const slug = req.params.slug;

  db.one('select * from forums where slug = $1', slug)
    .then(function (data) {
      let query = 'select * from users where (users.nickname in (' +
        ' select distinct threads.author from threads where threads.forum = $1 ) or users.nickname in (' +
        ' select distinct posts.author from posts where posts.forum = $2 )) ';
      if(!isEmpty(since)) {
        if(desc === "true") {
          query = query + ' and lower(users.nickname collate "ucs_basic") < ' +
            'lower($3 collate "ucs_basic")';
        } else {
          query = query + ' and lower(users.nickname collate "ucs_basic") > ' +
            'lower($3 collate "ucs_basic")';
        }
      }
      query = query +  ' order by lower(users.nickname collate "ucs_basic")';
      if(desc === "true") {
        query = query + " desc";
      } else {
        query = query + " asc";
      }
      if(!isEmpty(limit)) {
        query = query + " limit " + limit;
      }
      if(!isEmpty(since)) {
        return db.any(query, [data.id, data.slug, since]);
      } else {
        return db.any(query, [data.id, data.slug]);
      }
    })
    .then(function (data) {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      res.status(200).send(d);
    })
    .catch(function (err) {
      res.status(404).send(err);
    });


  // let slug = req.params.slug;
  // let forumId = 0;
  // let desc = 'asc';
  // if('desc' in req.query && req.query.desc === 'true') {
  //   desc = 'desc';
  // }
  // let limit = 0;
  // if('limit' in req.query) {
  //   limit = req.query.limit;
  // }
  // let since = '';
  // if('since' in req.query) {
  //   since = req.query.since;
  // }
  //
  // db.one('select * from forums where slug = $1', slug)
  //   .then( data => {
  //     let query = 'select * from users where nickname in ' +
  //       '(select user_nickname from users_forums where forum_id = $1) ';
  //     if (!isEmpty(since)) {
  //       if(desc === 'desc') {
  //         query +=' and lower(users.nickname collate "ucs_basic") < lower($2 collate "ucs_basic")';
  //       } else {
  //         query +=' and lower(users.nickname collate "ucs_basic") > lower($2 collate "ucs_basic")';
  //       }
  //     }
  //     query +=  ' order by lower(users.nickname collate "ucs_basic") ' + desc;
  //     if (limit !== 0) {
  //       query += ' limit ' + limit;
  //     }
  //     if(!isEmpty(since)) {
  //       return db.any(query, [data.id, since]);
  //     } else {
  //       return db.any(query, [data.id]);
  //     }
  //   })
  //   .then( data => {
  //     let d = JSON.stringify(data);
  //     d = JSON.parse(d);
  //     res.status(200).send(d);
  //   })
  //   .catch( err => {
  //     res.status(404).send(err);
  //   });


  // db.one('select * from forums where slug = $1', slug)
  //   .then( data => {
  //     forumId = data.id;
  //     let query = ' select  distinct on (lower(users.nickname collate "ucs_basic")) users.nickname, ' +
  //       ' users.fullname, users.email, users.about from users ' +
  //       ' inner join users_forums on (users.nickname = users_forums.user_nickname)' +
  //       ' where users_forums.forum_id = ' + forumId;
  //     if(!isEmpty(since)) {
  //       if(desc === 'desc') {
  //         query +=' and lower(users.nickname collate "ucs_basic") < lower($3 collate "ucs_basic")';
  //       } else {
  //         query +=' and lower(users.nickname collate "ucs_basic") > lower($3 collate "ucs_basic")';
  //       }
  //     }
  //     query +=  ' order by lower(users.nickname collate "ucs_basic") ' + desc;
  //     if(limit !== 0) {
  //       query += ' limit ' + limit;
  //     }
  //     if(!isEmpty(since)) {
  //       return db.any(query, [data.id, data.slug, since]);
  //     } else {
  //       return db.any(query, [data.id, data.slug]);
  //     }
  //   })
  //   .then( data => {
  //     let d = JSON.stringify(data);
  //     d = JSON.parse(d);
  //     res.status(200).send(d);
  //   })
  //   .catch( err => {
  //     res.status(404).send(err);
  //   });

  // db.one('select * from forums where slug = $1', slug)
  //   .then( data => {
  //     let query = 'select * from users where (users.nickname in (' +
  //       ' select distinct threads.author from threads where threads.forum = $1 ) or users.nickname in (' +
  //       ' select distinct posts.author from posts where posts.forum = $2 )) ';
  //     if(!isEmpty(since)) {
  //       if(desc === 'desc') {
  //         query +=' and lower(users.nickname collate "ucs_basic") < lower($3 collate "ucs_basic")';
  //       } else {
  //         query +=' and lower(users.nickname collate "ucs_basic") > lower($3 collate "ucs_basic")';
  //       }
  //     }
  //     query +=  ' order by lower(users.nickname collate "ucs_basic") ' + desc;
  //     if(limit !== 0) {
  //       query += ' limit ' + limit;
  //     }
  //     if(!isEmpty(since)) {
  //       return db.any(query, [data.id, data.slug, since]);
  //     } else {
  //       return db.any(query, [data.id, data.slug]);
  //     }
  //   })
  //   .then( data => {
  //     let d = JSON.stringify(data);
  //     d = JSON.parse(d);
  //     res.status(200).send(d);
  //   })
  //   .catch( err => {
  //     res.status(404).send(err);
  //   });
}

function getPost(req, res, next) {
  let id = req.params.id;
  let resp = {};

  db.one('select id, author, created, forum, isEdited as \"isEdited\", ' +
    'message, thread, parent from posts where id = $1', id)
    .catch( err => {
      res.status(404).send(err);
    })
    .then( data => {
      resp.post = data;
      db.tx( t => {
        let que = [];
        let q1 = t.one('select * from users where nickname=$1', data.author);
        let q2 = t.one('select forums.slug as forum, threads.author, threads.id, threads.slug, threads.title,' +
          ' threads.message, threads.created, threads.votes from threads inner join forums on (threads.forum=forums.id)' +
          ' where threads.id = $1', data.thread);
        let q3 = t.one('select slug, username as \"user\", title, posts, threads from forums where slug = $1', data.forum);
        if('related' in req.query) {
          if(req.query.related.indexOf('user') !== -1) {
            que.push(q1);
          }
          if (req.query.related.indexOf('thread') !== -1) {
            que.push(q2);
          }
          if (req.query.related.indexOf('forum') !== -1) {
            que.push(q3);
          }
        }
        return t.batch(que);
      })
        .then( data => {
          if ('related' in req.query) {
            if (req.query.related.indexOf('user') !== -1) {
              resp.author = data[0];
              if (req.query.related.indexOf('thread') !== -1) {
                resp.thread = data[1];
                if (req.query.related.indexOf('forum') !== -1) {
                  resp.forum = data[2];
                }
              } else if (req.query.related.indexOf('forum') !== -1) {
                resp.forum = data[1];
              }
            } else if (req.query.related.indexOf('thread') !== -1) {
              resp.thread = data[0];
              if (req.query.related.indexOf('forum') !== -1) {
                resp.forum = data[1];
              }
            } else if (req.query.related.indexOf('forum') !== -1) {
              resp.forum = data[0];
            }
          }
          res.status(200).send(resp);
        })
        .catch( err => {
          res.status(404).send(err);
        });
    });
}

function updatePost(req, res, next) {
  let id = req.params.id;
  let message = req.body.message;

  db.one('select isEdited as \"isEdited\", author, created, forum, id, thread, message from posts where id = $1', id)
    .then( data => {
      let d = JSON.stringify(data);
      d = JSON.parse(d);
      if (!isEmpty(message) && (message !== data.message)) {
        return db.tx( t => {
          let q1 = t.none('update posts set (message, isEdited) = (\'' + message + '\', true) where id = $1', id);
          let q2 = t.one('select isEdited as \"isEdited\", author, created, forum, id, thread, message from posts where id = $1', id);
          return t.batch([q1, q2]);
        })
      } else {
        res.status(200).send(d);
      }
    })
    .then( data => {
      let d = JSON.stringify(data[1]);
      d = JSON.parse(d);
      res.status(200).send(d);
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function getStatus(req, res, next) {
  let resp = {};

  db.tx( t => {
    let q1 = t.one('select count(*) from users');
    let q2 = t.one('select count(*) from threads');
    let q3 = t.one('select count(*) from posts');
    let q4 = t.one('select count(*) from forums');
    return t.batch([q1, q2, q3, q4]);
  })
    .then( data => {
      resp.user = parseInt(data[0].count);
      resp.thread = parseInt(data[1].count);
      resp.post = parseInt(data[2].count);
      resp.forum = parseInt(data[3].count);
      res.status(200).send(resp);
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

function serviceClear(req, res, next) {
  db.none('truncate users cascade')
    .then( () => {
      res.status(200).send();
    })
    .catch( err => {
      res.status(404).send(err);
    });
}

module.exports = {
  createUser: createUser,
  getUser: getUser,
  updateUser: updateUser,
  createForum: createForum,
  getForum: getForum,
  createThread: createThread,
  getThreads: getThreads,
  createOneThread: createOneThread,
  createVote: createVote,
  getThread: getThread,
  updateThread: updateThread,
  getPosts: getPosts,
  getUsers: getUsers,
  getPost: getPost,
  updatePost: updatePost,
  getStatus: getStatus,
  serviceClear: serviceClear
};
