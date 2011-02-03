package org.andyic.litcomp;

import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.Channel;

public class RabbitTestProducer {

	public static void main(String[] argv)
			throws java.io.IOException, java.lang.InterruptedException {

		// prepare RabbitMQ connection
		Connection conn = null;
		ConnectionFactory factory = new ConnectionFactory();
		factory.setHost("localhost");
		factory.setPort(8071);
		conn = factory.newConnection();

		Channel chan = conn.createChannel();
		chan.queueDeclare("hello", false, false, false, null);
		
		// send example message every 1 seconds
		while (true) {
			chan.basicPublish("", "hello", null, "Hello, World!".getBytes());
			System.out.println("Sent \"Hello, World!\"");
			Thread.sleep(1000);
		}
	}
}
