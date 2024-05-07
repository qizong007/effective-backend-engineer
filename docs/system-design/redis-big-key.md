# Redis 大 key 问题

## 大 key 标准

在一般的业务场景下（并发和容量要求都不大）：
- 单个string的`value＞1MB`
- 容器ds元素数量超过`10000`

在高并发且低延迟的场景中：（互联网上看到比较多的版本）
- 单个string的`value＞10KB`
- 容器ds元素数量超过`5000`或整体`value>10MB`

阿里云的[云版本Redis](https://help.aliyun.com/zh/redis/user-guide/identify-and-handle-large-keys-and-hotkeys#section-yxd-sx9-atn)：
- Key本身的数据量过大：一个String类型的Key，它的值为`5MB`
- Key中的成员数过多：一个ZSET类型的Key，它的成员数量为`10000`个
- Key中成员的数据量过大：一个Hash类型的Key，它的成员数量虽然只有`1000`个但这些成员的Value（值）总大小为`100MB`

但其实Redis大key问题的定义及评判准则并非一成不变，没有固定的判别标准，还是要根据Redis在实际业务中的使用来综合评估。（注意边界问题）

## 大 key 影响

1. 读取成本高
	- 时延（执行命令时间更长）
	- 带宽（大 key 消耗更多的带宽，从而影响相关服务）
2. 大key的写操作容易阻塞，从而导致无法正常响应
	- 慢查询
	- 主从同步异常
3. 占更多的存储空间，从而导致逐出，甚至是 OOM（Out Of Memory）
4. 集群架构下，某个数据分片的内存使用率远超其他数据分片，即数据分片的内存资源不均衡

> [!DANGER] 根本原因
> Redis 是单线程！

## 大 key 产生原因

1. 业务设计不合理。这是最常见的原因，不经过合理拆分，就直接把大json塞在一个key中；甚至塞二进制文件数据。
2. 没有处理好value的动态增长问题。如果一直添加value数据，没有定期的删除机制、合理的过期机制或者卡量，大key只是早晚的问题。（例如：微博明星的粉丝列表、热门评论、直播弹幕等）
3. 程序bug。某些异常情况导致某些key的生命周期超出预期，或者value数量异常增长。比如LIST的业务消费侧发生代码故障，造成对应Key的成员只增不减。

## 找到大 key

### bigkeys 参数

> 参考官方文档：https://redis.io/docs/latest/develop/connect/cli/#scanning-for-big-keys

使用redis-cli命令客户端，连接Redis服务的时候，加上 `--bigkeys` 参数，可以以遍历的方式分析Redis实例中的所有Key，并返回Key的整体统计信息与每个数据类型中Top1的大Key。（原理是基于`SCAN`）

```bash
$ redis-cli --bigkeys

# Scanning the entire keyspace to find biggest keys as well as
# average sizes per key type.  You can use -i 0.01 to sleep 0.01 sec
# per SCAN command (not usually needed).

[00.00%] Biggest string found so far 'key-419' with 3 bytes
[05.14%] Biggest list   found so far 'mylist' with 100004 items
[35.77%] Biggest string found so far 'counter:__rand_int__' with 6 bytes
[73.91%] Biggest hash   found so far 'myobject' with 3 fields

-------- summary -------

Sampled 506 keys in the keyspace!
Total key length in bytes is 3452 (avg len 6.82)

Biggest string found 'counter:__rand_int__' has 6 bytes
Biggest   list found 'mylist' has 100004 items
Biggest   hash found 'myobject' has 3 fields

504 strings with 1403 bytes (99.60% of keys, avg size 2.78)
1 lists with 100004 items (00.20% of keys, avg size 100004.00)
0 sets with 0 members (00.00% of keys, avg size 0.00)
1 hashs with 3 fields (00.20% of keys, avg size 3.00)
0 zsets with 0 members (00.00% of keys, avg size 0.00)
```
> [!TIP] 总结
> - 优点：方便、快速、安全。
> - 缺点：分析结果不可定制化，准确性与时效性差。

### Redis RDB Tools工具
使用支持定制化分析的开源工具[Redis RDB Tools](https://github.com/sripathikrishnan/redis-rdb-tools)，分析RDB文件，扫描出Redis大key。可以根据自己的精细化需求，全面地分析Redis实例中所有Key的内存占用情况，同时也支持灵活地分析查询。

例如：输出占用内存大于 128 Byte，排名前5的keys到csv文件。

```bash
$ rdb —c memory dump.rbd -—bytes 128 —-largest 5 -f memory.csv
$ cat memory.csv

database,type,key,size_in_bytes,encoding,num_elements,len_largest_element
0,list,lizards,241,quicklist,5,19
0,list,user_list,190,quicklist,3,7
2,hash,baloon,138,ziplist,3,11
2,list,armadillo,231,quicklist,5,20
2,hash,aroma,129,ziplist,3,11
```

> [!TIP] 总结
> - 优点：支持定制化分析，对线上服务无影响。
> - 缺点：时效性差，RDB文件较大时耗时较长。

### 可观测性分析

- 使用监控工具来跟踪性能指标，如延迟、吞吐量和错误率。（灵活、及时；但是可能会对业务性能有影响，也可能有一定业务入侵）
- 分析慢查询日志，查看是否有耗时较长的操作，这可能是大 key 导致的。（也有一定滞后性）
- 直接使用云服务提供的Top Key统计能力

## 大 key 优化
 
1. 【根本】业务侧优先考虑避免大key设计，不要啥都往里塞， **仅缓存必要的数据字段**
2. 拆，分片
    - 定量 or 动态？
        - 定量：需要考虑 value 增长的问题
        - 动态分片：先按原key读第一个分片，第一个分片的value告诉你有几片，再分别按照shard_num取
    - 部分写问题
        - 引入版本机制解决
        - value最前面带上版本号
        - 一个分片不对就算错误，回源读取，重新加载
    - 开发成本
    - 维护成本
    - 组装成本
3. 直接换别的没有大 key 问题的存储
	- 持久型 kv 存储
		- 软件：LSM-Tree [RocksDB：不丢数据的高性能 KV 存储 | MRCODE-BOOK](https://zq99299.github.io/note-book/back-end-storage/03/10.html#lsm-tree-%E5%A6%82%E4%BD%95%E5%85%BC%E9%A1%BE%E8%AF%BB%E5%86%99%E6%80%A7%E8%83%BD)
		- 硬件：固态存储
	- local cache，与 redis 配合多层缓存结构
	- CDN
4. （针对 string）考虑使用容器型数据结构替换 string，提高内存利用效率，也能一定程度节省键名空间
5. 数据压缩
6. 有合理的清理机制

## 大 key 清理

> 直接删除的话容易阻塞（单线程），会影响到其他线上请求；超时越来越多，会造成 Redis 连接耗尽，从而引发各种异常问题

1. 低峰期删除：选择业务流量低的时期清理缓存（无法彻底解决）
2. 分批定时定量删除：一次删除一部分，防止一次性删除大批量数据导致阻塞
	- hash：hscan 扫描
	- set：srandmember 随机取数删除
	- zset：zremrangebyrank 移除指定排名(rank)区间内的所有元素
	- list：直接 pop 删
3. 异步删除：用 `unlink` 代替 `del` 删除（只是将键与键空间**断开连接**，实际的删除将稍后异步进行，以非阻塞的方式，逐步地清理传入的Key，不阻塞主线程）
