import { prepareContentPublisher } from "@canva/intents/content";
import contentPublisher from "./intents/content_publisher";

// Register exactly once when the Canva iframe loads.
prepareContentPublisher(contentPublisher);
