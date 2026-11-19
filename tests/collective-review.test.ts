import test from 'node:test';
import assert from 'node:assert/strict';
import { canReviewCollective } from '../lib/collective-access.ts';
import { submissionPage, reviewPageNumber } from '../lib/collective-submissions.ts';
test('creator role does not confer reviewer access',()=>{
 const user={email_confirmed_at:'2026-11-01',app_metadata:{hosting_collective:{role:'partner',status:'active'}}};
 assert.equal(canReviewCollective(user),false);
 assert.equal(canReviewCollective({...user,app_metadata:{hosting_collective_reviewer:true}}),true);
 assert.equal(canReviewCollective({...user,is_anonymous:true,app_metadata:{hosting_collective_reviewer:true}}),false);
 assert.equal(canReviewCollective({...user,email_confirmed_at:null,app_metadata:{hosting_collective_reviewer:true}}),false);
});
test('invalid or unexpected submission data fails closed instead of claiming no applications',()=>{
 for(const data of [null,{}, {submissions:[]}, {submissions:[{isCompleted:true}],questions:[],hasMore:false}]) assert.throws(()=>submissionPage(data));
 assert.deepEqual(submissionPage({submissions:[],questions:[],hasMore:false}),{submissions:[],hasMore:false});
});
test('normalizer retains text without executing markup or leaking other provider fields',()=>{
 const r=submissionPage({submissions:[{id:'s1',submittedAt:'2026-11-01',isCompleted:true,secret:'omit',responses:[{questionId:'name',answer:'<script>bad</script>'}]}],questions:[{id:'name',label:'Name',type:'INPUT_TEXT'}],hasMore:true});
 assert.equal(r.submissions[0].answers[0].value,'<script>bad</script>');
 assert.equal('secret' in r.submissions[0],false);
 assert.equal(r.hasMore,true);
});
test('pagination cannot inject query parameters',()=>{
 for(const value of ['0','-1','2&limit=999','99999','NaN']) assert.equal(reviewPageNumber(value),1);
 assert.equal(reviewPageNumber('2'),2);
});
